module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const { password } = req.body || {}

  if (!process.env.SITE_PASSWORD) {
    return res.status(500).json({ error: 'SITE_PASSWORD env variable not set' })
  }

  if (password === process.env.SITE_PASSWORD) {
    res.setHeader(
      'Set-Cookie',
      'site-auth=1; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800'
    )
    return res.status(200).json({ ok: true })
  }

  return res.status(401).json({ error: 'Incorrect password' })
}
