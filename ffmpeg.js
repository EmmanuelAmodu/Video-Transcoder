const { exec } = require("child_process");
const fs = require('fs');

const flags = constructFlagObject(process.argv.slice(2));
console.log(flags)

const resolutionList = {
  '320': '1100k',
  '480': '2400k',
  '576': '3600k',
  '720': '4800k',
  '960': '6000k'
};

const dir = 'outputs/hls';
if (!fs.existsSync(dir.split('/')[0])) fs.mkdirSync(dir.split('/')[0]);
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

const segmentsCommand = Object.keys(resolutionList)
  .map((value, index, array) => {
    let segC = `  -vf scale=-2:${value} -c:a aac -ar 48000 -c:v libx264 -profile:v high -crf 20 -sc_threshold 0 -g 48 -keyint_min 48 -hls_time ${flags['-sec'] || 6} -hls_flags split_by_time -hls_playlist_type vod -b:v ${resolutionList[value]} -maxrate:v ${(resolutionList[value].slice(0, -1) * 1000) + ((resolutionList[value].slice(0, -1) * 1000) * 0.1)} -bufsize:v ${(resolutionList[value].slice(0, -1) * 1000) * 0.35} -hls_segment_filename ${dir}/${value}p_%03d.ts ${dir}/${value}p.m3u8`;
    if (array.length - 1 !== index) segC += ` \\`
    return segC;
  });

const command = `ffmpeg -y -i ${flags['-file']} \\\n${segmentsCommand.join('\n')} 2>&1`
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
  getTranscodedFileMetadata()
    .then(res => createMasterManifest(res))
    .catch(err => console.log(err));
});

function getTranscodedFileMetadata() {
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
    content += `#EXT-X-STREAM-INF:AVERAGE-BANDWIDTH=${el.bandWidth * 0.7},BANDWIDTH=${el.bandWidth},RESOLUTION=${el.dimension},CODECS="H.264",FRAME-RATE=${el.framerate}\n${el.resolution}p.m3u8\n`;
  }

  console.log(content)
  fs.writeFileSync(`${dir}/master.m3u8`, content);
}

function constructFlagObject(rawFlags) {
  const flagObject = {};
  for (let i = 0; i < rawFlags.length; i++) {
    const flags = rawFlags[i].split('=');
    flagObject[flags[0]] = flags[1];
  }
  return flagObject;
}
