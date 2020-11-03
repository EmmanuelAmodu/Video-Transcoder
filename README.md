# Usage

1. To transcode a local file (raw-flie/tos-teaser.mp4) run
- node ffmpeg.js raw-flie/tos-teaser.mp4

2. So serve transcoded file run
- node server.js
- Add http://localhost:8000/hls/master.m3u8 to videos file