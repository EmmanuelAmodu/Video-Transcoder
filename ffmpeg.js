const { exec } = require("child_process");
const fs = require('fs');

const inputFile = process.argv.slice(2)[0];

const resolutionList = {
  '480': '1100k',
  '576': '2400k',
  '720': '3600k',
  '960': '4800k',
  '1080': '6000k'
};

const dir = 'outputs/hls';
if (!fs.existsSync(dir.split('/')[0])) fs.mkdirSync(dir.split('/')[0]);
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const segmentsCommand = Object.keys(resolutionList)
  .map((value, index, array) => {
    let segC = `  -vf scale=-2:${value} -c:a aac -ar 48000 -c:v h264 -profile:v main -crf 20 -sc_threshold 0 -g 48 -keyint_min 48 -hls_time 6 -hls_playlist_type vod -b:v ${resolutionList[value]} -b:a 128k -hls_segment_filename ${dir}/${value}p_%03d.ts ${dir}/${value}p.m3u8`;
    if (array.length - 1 !== index)
      segC += ` \\`
    return segC;
  });

const command = `ffmpeg -y -i ${inputFile} \\\n${segmentsCommand.join('\n')} 2>&1`
console.log(command);

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.log(`error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.log(`stderr: ${stderr}`);
    return;
  }

  console.log(stdout);
  getTranscodedVideoMetadata()
    .then(res => createMasterManifest(res))
    .catch(err => console.log(err))
});

function getTranscodedVideoMetadata() {
  let rsult = Object.keys(resolutionList).map(resolution => {
    const segmentIndex = `ffmpeg -i ${dir}/${resolution}p_000.ts 2>&1 | grep Stream.*Video`
    return new Promise((resolve, reject) => {
      exec(segmentIndex, (error, stdout, stderr) => {
        if (error) {
          console.log(`error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.log(`stderr: ${stderr}`);
          return;
        }

        const values = stdout.split(', ');
        const rawCodec = values.shift();

        resolve({
          dimension: values[1],
          bandWidth: parseInt(resolutionList[resolution].replace('k', '000')),
          resolution: resolution,
          framerate: values[2].replace(" fps", ""),
          codec: rawCodec.substring(rawCodec.indexOf("Video: ") + 7, rawCodec.indexOf(" (Main)")),
          file: `${resolution}p.m3u8`
        });
      })
    })
  });

  return Promise.all(rsult)
}

function createMasterManifest(data){
  console.log(data)
  let content = `#EXTM3U\n#EXT-X-VERSION:3\n`
  for (let i = 0; i < data.length; i++) {
    const el = data[i];
    content += `#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=${el.bandWidth * 0.7},BANDWIDTH=${el.bandWidth},RESOLUTION=${el.dimension},CODECS="${el.codec}",FRAME-RATE=${el.framerate}\n${el.file}\n`
  }

  console.log(content)
  fs.writeFileSync(`${dir}/master.m3u8`, content);
}
