const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive:true });

const allowedExtensions = new Set([".wav",".mp3",".m4a",".flac",".ogg",".webm"]);
const allowedMimes = new Set(["audio/wav","audio/wave","audio/x-wav","audio/mpeg","audio/mp3","audio/mp4","audio/x-m4a","audio/flac","audio/ogg","audio/webm","application/octet-stream"]);

const storage = multer.diskStorage({
  destination: (_req,_file,cb) => cb(null, uploadDir),
  filename: (_req,file,cb) => cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname).toLowerCase()}`)
});

const fileFilter = (_req,file,cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.has(ext) && (allowedMimes.has(file.mimetype) || file.mimetype === "")) return cb(null,true);
  cb(new Error("Unsupported audio format. Use WAV, MP3, M4A, FLAC, OGG, or WEBM."));
};

module.exports = multer({
  storage,
  fileFilter,
  limits:{ fileSize:(Number(process.env.MAX_FILE_SIZE_MB)||100)*1024*1024 }
});
