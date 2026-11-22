function canEditNovel(novel, user) {
  return Boolean(novel && user && (novel.uploaderId === user.sub || user.role === 'ADMIN'));
}

module.exports = { canEditNovel };
