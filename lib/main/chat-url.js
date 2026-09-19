function isAllowedChatUrl(value) {
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com';
    return url.protocol === 'https:' && allowedHost && url.pathname === '/live_chat';
  } catch {
    return false;
  }
}

module.exports = { isAllowedChatUrl };
