module.exports = function handler(_request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.redirect(302, "https://jihoo125.it.kr/audio/001.mp3");
};
