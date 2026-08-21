const pool = require('../config/database');

let testimonialsReady = false;

const ensureTestimonialsTable = async (db = pool) => {
  if (testimonialsReady) return;

  await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await db.query(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      submitter_name VARCHAR(140) NOT NULL,
      submitter_email VARCHAR(180),
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT testimonials_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
    )
  `);
  await db.query('CREATE INDEX IF NOT EXISTS idx_testimonials_status_created ON testimonials(status, created_at DESC)');
  testimonialsReady = true;
};

const cleanText = (value, maxLength) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);

const formatPublicName = (name) => {
  const parts = cleanText(name, 140).split(' ').filter(Boolean);
  if (parts.length === 0) return 'Utilizador Yeto';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.`;
};

const mapPublicTestimonial = (item) => ({
  id: item.id,
  name: formatPublicName(item.submitter_name),
  message: item.message,
  created_at: item.created_at
});

const getApprovedTestimonials = async (req, res) => {
  try {
    await ensureTestimonialsTable();
    const result = await pool.query(`
      SELECT id, submitter_name, message, created_at
      FROM testimonials
      WHERE status = 'approved'
      ORDER BY reviewed_at DESC NULLS LAST, created_at DESC
      LIMIT 20
    `);

    res.json({ testimonials: result.rows.map(mapPublicTestimonial) });
  } catch (error) {
    console.error('Erro ao buscar depoimentos:', error);
    res.status(500).json({ error: 'Erro ao buscar depoimentos.' });
  }
};

const submitTestimonial = async (req, res) => {
  const name = cleanText(req.body?.name, 140);
  const email = cleanText(req.body?.email, 180).toLowerCase();
  const message = cleanText(req.body?.message, 700);

  if (name.length < 2) {
    return res.status(400).json({ error: 'Informe o seu nome para enviar o depoimento.' });
  }

  if (message.length < 20) {
    return res.status(400).json({ error: 'Escreva um depoimento com pelo menos 20 caracteres.' });
  }

  try {
    await ensureTestimonialsTable();
    const result = await pool.query(`
      INSERT INTO testimonials (submitter_name, submitter_email, message)
      VALUES ($1, NULLIF($2, ''), $3)
      RETURNING id, status, created_at
    `, [name, email, message]);

    res.status(201).json({
      message: 'Depoimento enviado com sucesso. Obrigado por partilhar a sua experiência.',
      testimonial: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao enviar depoimento:', error);
    res.status(500).json({ error: 'Erro ao enviar depoimento.' });
  }
};

const getAdminTestimonials = async (req, res) => {
  try {
    await ensureTestimonialsTable();
    const result = await pool.query(`
      SELECT
        t.id,
        t.submitter_name,
        t.submitter_email,
        t.message,
        t.status,
        t.created_at,
        t.reviewed_at,
        reviewer.name AS reviewed_by_name
      FROM testimonials t
      LEFT JOIN users reviewer ON reviewer.id = t.reviewed_by
      ORDER BY
        CASE t.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
        t.created_at DESC
      LIMIT 300
    `);

    res.json({ testimonials: result.rows });
  } catch (error) {
    console.error('Erro ao buscar depoimentos admin:', error);
    res.status(500).json({ error: 'Erro ao buscar depoimentos.' });
  }
};

const reviewTestimonial = (status) => async (req, res) => {
  const { testimonialId } = req.params;
  const adminId = req.user?.id || null;

  try {
    await ensureTestimonialsTable();
    const result = await pool.query(`
      UPDATE testimonials
      SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $3
      RETURNING id, submitter_name, submitter_email, message, status, created_at, reviewed_at
    `, [status, adminId, testimonialId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Depoimento não encontrado.' });
    }

    await pool.query(
      'INSERT INTO admin_logs (admin_id, action_type, description) VALUES ($1, $2, $3)',
      [adminId, status === 'approved' ? 'success' : 'warning', `${status === 'approved' ? 'Aprovou' : 'Rejeitou'} depoimento de ${result.rows[0].submitter_name}`]
    ).catch(() => undefined);

    res.json({
      message: status === 'approved' ? 'Depoimento aprovado e publicado.' : 'Depoimento rejeitado.',
      testimonial: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao moderar depoimento:', error);
    res.status(500).json({ error: 'Erro ao moderar depoimento.' });
  }
};

module.exports = {
  ensureTestimonialsTable,
  getApprovedTestimonials,
  submitTestimonial,
  getAdminTestimonials,
  approveTestimonial: reviewTestimonial('approved'),
  rejectTestimonial: reviewTestimonial('rejected')
};
