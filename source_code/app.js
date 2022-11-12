const cheerio = require("cheerio");
const fetch = require("node-fetch");

const fs = require("fs");
const FileSystemCache_1 = require("file-system-cache");

const playlistoptions = {
  basePath: "./.cache/playlist", // Optional. Path where cache files are stored (default).
  ns: "playlist", // Optional. A grouping namespace for items.
};
const videoOptions = {
  basePath: "./.cache/videos", // Optional. Path where cache files are stored (default).
  ns: "videos", // Optional. A grouping namespace for items.
};
const playlistCache = new FileSystemCache_1.FileSystemCache(playlistoptions);
const videoCache = new FileSystemCache_1.FileSystemCache(videoOptions);

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
// const { title } = require("process");

const gettingVideosURL = async (url) => {
  let playListName = await getData(url);
  if (!playListName || playListName == "null") {
    console.log(
      "Error in accesing playlist. Make sure to have your playlist visibility is unlisted or public"
    );
    return;
  }
  playListName = playListName.replace(regExURL, " ");
  console.log("playlist name: ", playListName);
  let list = [];
  if (await playlistCache.fileExists(url)) {
    list = await playlistCache.get(url);
  } else {
    list = await scrapePage(url);
    await playlistCache.set(url, list);
  }

  return { list, playListName };
};

const mainDownload = (playListName, downURL, title, type) => {
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

      resolve(downloadStatus);
    } catch (error) {
      //IMPORTANT: Handle a possible error. An error is thrown in case of network errors, or status codes of 400 and above.
      //Note that if the maxAttempts is set to higher than 1, the error is thrown only if all attempts fail.
      // console.log("Download failed", error);
      reject(error);
    }
  });
};

const main = async (url, q) => {
  const { list, playListName } = await gettingVideosURL(url);

  let i = 1;

  if (!q || !VALID_Q.includes(q)) {
    q = "480";
  }

  const videoList = [];
  for (let lis of list) {
    let title = await getData(lis);
    title = title.replace(regExURL, " ");

    const isExist = fs.existsSync(`${playListName}/${title}.mp4`);
    if (isExist) {
      console.log(`${title} already exist`);
      continue;
    }

    let data = {};

    if (await videoCache.fileExists(lis)) {
      data = await videoCache.get(lis);
    } else {
      data = await GetVideo(lis, q);
      videoCache.set(lis, data);
    }
    // .then(async (data) => {
    // let title = data.title;

    const downURL = data.urlDown;
    console.log(i, ": ", downURL);
    i++;

    if (downURL === "Error") {
      console.log("deteced", title);
      continue;
    }

    try {
      const res = await mainDownload(playListName, downURL, title, "video");
      console.log("completed");
    } catch (err) {
      console.log("error: ", err);
    }
    // videoList.push({ downURL, title });
    // await mainDownload(playListName, downURL, title, "video");
    // });
  }
  // console.log('videoList: ',videoList)
  // for (let videoli of videoList) {

  // }
};

if (!fs.existsSync("./playlist")) {
  fs.mkdirSync("./playlist");
  fs.writeFileSync("playlist/playlist.txt", "");
  fs.writeFileSync("playlist/quality.txt", "");
  fs.writeFileSync("playlist/playlist_audio.txt", "");
  fs.writeFileSync("playlist/clear_cache.txt", "");
}

const cacheClearStatus = fs.readFileSync("playlist/clear_cache.txt").toString();

if (
  cacheClearStatus.length >= 1 &&
  (cacheClearStatus[0] === "y" || cacheClearStatus[0] === "Y")
) {
  playlistCache.clear();
  videoCache.clear();
}

let file;
try {
  file = fs.readdirSync("playlist");
} catch (err) {
  console.log("err: ", err);
}

const downloadAudio = async (url) => {
  const { list, playListName } = await gettingVideosURL(url);
  let i = 1;

  const audioList = [];
  for (let lis of list) {
    let title = "";
    try {
      title = await getData(lis);
    } catch (err) {
      console.error(err);
    }
    title = title.replace(regExURL, " ");

    const isExist = fs.existsSync(`${playListName}/${title}.mp3`);
    if (isExist) {
      console.log(`${title} already exist`);
      continue;
    }
    const data = await GetAudio(lis);
    // .then(async (data) => {
    // let title = data.title;

    const downURL = data.urlDown;
    console.log(i, ": ", downURL);
    i++;

    if (downURL === "Error") {
      console.log("deteced", title);
      continue;
    }

    try {
      const res = await mainDownload(playListName, downURL, title, "audio");
      console.log("completed");
    } catch (err) {
      console.log("error: ", err);
    }

    // audioList.push({ downURL, title });
    // });
  }

  // for (let audioLi of audioList) {

  // }
};

const str1 = fs.readFileSync("playlist/" + "playlist.txt").toString();
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
  const str2 = fs.readFileSync("playlist/" + "quality.txt").toString();
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
