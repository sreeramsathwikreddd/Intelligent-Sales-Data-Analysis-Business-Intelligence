require("dotenv").config({path:require("path").join(__dirname,".env")});
const express=require("express");const cors=require("cors");const helmet=require("helmet");const rateLimit=require("express-rate-limit");const mongoose=require("mongoose");const multer=require("multer");
const connectDB=require("./config/ISDABI Database");const {checkAIHealth}=require("./services/ISDABI AI Service");
const authRoutes=require("./routes/ISDABI Auth Routes");
const userManagementRoutes=require("./routes/ISDABI User Management Routes");const callRoutes=require("./routes/ISDABI Call Routes");const analyticsRoutes=require("./routes/ISDABI Analytics Routes");const reportRoutes=require("./routes/ISDABI Report Routes");
const app=express();const PORT=Number(process.env.PORT)||5000;
app.disable("x-powered-by");app.use(helmet());app.use(cors({origin:process.env.CORS_ORIGIN||"http://localhost:5173",credentials:true}));app.use(express.json({limit:"1mb"}));app.use(express.urlencoded({extended:true}));app.use("/api",rateLimit({windowMs:15*60*1000,max:200,standardHeaders:true,legacyHeaders:false}));
app.get("/api/health",async(_req,res)=>{const ai=await checkAIHealth();res.json({success:true,service:"ISDABI Backend",mongodb:mongoose.connection.readyState===1?"connected":"disconnected",ai:ai.ok?"reachable":"unreachable",aiDetail:ai.data||ai.error,timestamp:new Date().toISOString()})});
app.use("/api/auth",authRoutes);
app.use("/api/user-management",userManagementRoutes);app.use("/api/calls",callRoutes);app.use("/api/analytics",analyticsRoutes);app.use("/api/reports",reportRoutes);
app.use((err,_req,res,_next)=>{console.error("[ISDABI error]",err);if(err instanceof multer.MulterError)return res.status(400).json({success:false,message:err.code==="LIMIT_FILE_SIZE"?"File too large.":err.message});if(err.message?.startsWith("Unsupported audio"))return res.status(400).json({success:false,message:err.message});res.status(500).json({success:false,message:"Internal server error."})});
(async()=>{try{if(!process.env.JWT_SECRET)throw new Error("JWT_SECRET is required in .env");await connectDB();app.listen(PORT,()=>console.log(`[ISDABI] Backend listening on http://localhost:${PORT}`));}catch(error){console.error("[ISDABI] Startup failed:",error.message);process.exit(1)}})();

