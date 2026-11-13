// Keep all admin entry points behind the Access-protected production hostname.
export async function onRequest(context) {
    const url = new URL(context.request.url);
    if (url.hostname !== 'malangnuo.com') {
        url.protocol = 'https:';
        url.hostname = 'malangnuo.com';
        url.port = '';
        return Response.redirect(url.href, 302);
    }
    return context.next();
}
