const cheerio = require("cheerio");
const fetch = require("node-fetch");

const fs = require("fs");
const GetVideo = require("./GetVideo");
const GetAudio = require("./GetAudio");

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const VALID_Q = ["144", "240", "360", "480", "720", "1080"];

const Downloader = require("nodejs-file-downloader");

const regExURL = /[?:&"\/|]+/g;

const getData = async (url) => {
  const response = await fetch(url);
  const html = await response.text();

  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    $('meta[name="title"]').attr("content");
  return title;
};

const PORT = 8081;
const express = require("express");

const app = express();
const { scrapePage } = require("./scraper");

const mainDownload =  (playListName, downURL, title, type) => {
  return new Promise(async (resolve, reject) => {
  let extension = "";
  if (type === "video") extension = ".mp4";
  else extension = ".mp3";
  const downloader = new Downloader({
    url: downURL, //If the file name already exists, a new file with the name 200MB1.zip is created.
    directory: "./" + playListName, //This folder will be created, if it doesn't exist.
    cloneFiles: false,
    onError: function (error) {
      //You can also hook into each failed attempt.
      console.log("Error from attempt ", error);
    },
    fileName: title + extension,
  });
  try {
    const { filePath, downloadStatus } = await downloader.download(); //Downloader.download() resolves with some useful properties.

    resolve(downloadStatus)

  } catch (error) {
    //IMPORTANT: Handle a possible error. An error is thrown in case of network errors, or status codes of 400 and above.
    //Note that if the maxAttempts is set to higher than 1, the error is thrown only if all attempts fail.
    // console.log("Download failed", error);
    reject(error)
  }
})
  
};

const main = async (url, q) => {
  let playListName = await getData(url);
  if (!playListName || playListName == "null") {
    console.log(
      "Error in accesing playlist. Make sure to have your playlist visibility is unlisted or public"
    );
    return;
  }
  playListName = playListName.replace(regExURL, " ");
  console.log("playlist name: ", playListName);

  const list = await scrapePage(url);
  let i = 1;

  if (!q || !VALID_Q.includes(q)) {
    q = "480";
  }

  const videoList=[]
  for (let lis of list) {
    const data=await GetVideo(lis, q)
    // .then(async (data) => {
      let title = data.title;
      title = title.replace(regExURL, " ");

      const isExist = fs.existsSync(`${playListName}/${title}.mp4`);
      if (isExist) {
        console.log(`${title} already exist`);
        continue;
      }

      const downURL = data.urlDown;
      console.log(i, ": ", downURL);
      i++;

      if (downURL === "Error") {
        console.log("deteced", title);
        continue;
      }
      videoList.push({downURL,title})
      // await mainDownload(playListName, downURL, title, "video");
    // });
  }
  // console.log('videoList: ',videoList)
  for(let videoli of videoList)
  {
    try{
      const res=await mainDownload(playListName,videoli.downURL,videoli.title,'video')
      console.log('completed')
    }
    catch(err){
      console.log('error: ',err)
    }
    
  }

};

if (!fs.existsSync("./playlist")) {
  fs.mkdirSync("./playlist");
  fs.writeFileSync("playlist/playlist.txt", "");
  fs.writeFileSync("playlist/quality.txt", "");
  fs.writeFileSync("playlist/playlist_audio.txt", "");
}

let file;
try {
  file = fs.readdirSync("playlist");
} catch (err) {
  console.log("err: ", err);
}

const downloadAudio = async (url) => {
  let playListName = await getData(url);
  if (!playListName || playListName == "null") {
    console.log(
      "Error in accesing playlist. Make sure to have your playlist visibility is unlisted or public"
    );
    return;
  }
  playListName = playListName.replace(regExURL, " ");
  console.log("playlist name: ", playListName);

  const list = await scrapePage(url);
  let i = 1;

  const audioList=[]
  for (let lis of list) {
    const data=await GetAudio(lis)
    // .then(async (data) => {
      let title = data.title;
      title = title.replace(regExURL, " ");

      const isExist = fs.existsSync(`${playListName}/${title}.mp3`);
      if (isExist) {
        console.log(`${title} already exist`);
        continue;
      }

      const downURL = data.urlDown;
      console.log(i, ": ", downURL);
      i++;

      if (downURL === "Error") {
        console.log("deteced", title);
        continue;
      }

      audioList.push({downURL,title})
    // });
  }

  for(let audioLi of audioList)
  {
    try{
      const res=await mainDownload(playListName,audioli.downURL,audioli.title,'audio')
      console.log('completed')
    }
    catch(err){
      console.log('error: ',err)
    }
  }
  
};

const str1 = fs.readFileSync("playlist/" + file[0]).toString();
const str3 = fs.readFileSync("playlist/" + "playlist_audio.txt").toString();

if (str3.length > 0) {
  const list = str3.split(/\s+/g);
  for (let lis of list) {
    if (
      lis.length == 0 ||
      !(lis.length > 4 && lis.substr(0, 4).toLowerCase() === "http")
    ) {
      console.log("Invalid url");
      continue;
    }
    console.log("lis: ", lis);
    downloadAudio(lis);
  }
}

if (str1.length == 0) {
  console.log(
    "Please start typing playlist links at playlist/playlist.txt separated by space or new line"
  );
} else {
  const str2 = fs.readFileSync("playlist/" + file[1]).toString();
  const list1 = str1.split(/\s+/g);
  const list2 = str2.split(/\s+/g);

  let x = 0;
  for (let lis of list1) {
    if (
      lis.length == 0 ||
      !(lis.length > 4 && lis.substr(0, 4).toLowerCase() === "http")
    ) {
      console.log("Invalid url");
      continue;
    }
    console.log("lis: ", lis);
    main(lis, list2[x]);
    x++;
  }
}

app.listen(PORT, () => {
  console.log(`app is running on port ${PORT}`);
});
