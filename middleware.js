export const config = {
  matcher: ['/', '/index.html'],
}

export default function middleware(request) {
  const cookie = request.headers.get('cookie') || ''
  const isAuthed = /(?:^|;\s*)site-auth=1(?:;|$)/.test(cookie)

  if (!isAuthed) {
    return Response.redirect(new URL('/login.html', request.url))
  }
}
