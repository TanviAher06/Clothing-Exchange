const express = require("express");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcryptjs");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-secret-before-deployment",
  resave:false, saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:1000*60*60*8}
}));
app.use(express.static(path.join(__dirname,"public")));

// Demo storage: data resets when the server restarts. Use MongoDB/PostgreSQL for production.
const users = [];
const items = [
 {id:1,title:"Vintage Denim Jacket",category:"Jackets",size:"M",brand:"Levi's",condition:"Very good",value:1800,city:"Pune",ownerId:2,ownerName:"Aarav K.",image:"https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=85",description:"Classic blue denim jacket, gently worn and freshly washed. No tears or missing buttons.",status:"available"},
 {id:2,title:"Floral Summer Dress",category:"Dresses",size:"S",brand:"Zara",condition:"Like new",value:1400,city:"Mumbai",ownerId:3,ownerName:"Meera S.",image:"https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=85",description:"Lightweight floral dress, worn twice. Great for brunch, holidays and summer outings.",status:"available"},
 {id:3,title:"Minimal White Sneakers",category:"Shoes",size:"UK 6",brand:"Puma",condition:"Good",value:1200,city:"Pune",ownerId:4,ownerName:"Ishita P.",image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85",description:"Comfortable everyday sneakers. Cleaned and ready for a new home.",status:"available"},
 {id:4,title:"Oversized Beige Shirt",category:"Tops",size:"L",brand:"H&M",condition:"Very good",value:700,city:"Nashik",ownerId:5,ownerName:"Rohan D.",image:"https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=900&q=85",description:"Relaxed fit neutral shirt that works well layered or on its own.",status:"available"},
 {id:5,title:"Everyday Black Backpack",category:"Accessories",size:"One size",brand:"Wildcraft",condition:"Good",value:900,city:"Ahilyanagar",ownerId:6,ownerName:"Sana M.",image:"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85",description:"Practical black backpack with multiple compartments. Zips are working properly.",status:"available"},
 {id:6,title:"Classic Knit Sweater",category:"Knitwear",size:"M",brand:"Uniqlo",condition:"Like new",value:1100,city:"Pune",ownerId:7,ownerName:"Kabir R.",image:"https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=85",description:"Soft knit sweater in a versatile colour, no visible pilling.",status:"available"},
 {id:7,title:"Pleated Midi Skirt",category:"Bottoms",size:"S",brand:"Westside",condition:"Very good",value:850,city:"Mumbai",ownerId:8,ownerName:"Anaya T.",image:"https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=900&q=85",description:"Flowy midi skirt in excellent wearable condition.",status:"available"},
 {id:8,title:"Sporty Zip Hoodie",category:"Jackets",size:"L",brand:"Nike",condition:"Good",value:1600,city:"Nashik",ownerId:9,ownerName:"Dev P.",image:"https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=85",description:"Comfortable zip hoodie suitable for everyday wear and travel.",status:"available"}
];
const requests=[], messages=[], reports=[];
let nextUser=10,nextItem=9,nextRequest=1001,nextMessage=1;
const admins = new Set(["admin@rewear.demo"]);
function publicUser(u){return {id:u.id,name:u.name,email:u.email,city:u.city,role:u.role||"user"}}
function currentUser(req){return req.session.userId ? users.find(u=>u.id===req.session.userId) : null}
function auth(req,res,next){if(!currentUser(req))return res.status(401).json({error:"Please log in to continue."});next()}
function adminOnly(req,res,next){const u=currentUser(req);if(!u||u.role!=="admin")return res.status(403).json({error:"Admin access required."});next()}
function safeItem(item){return {...item}}
app.get("/api/health",(req,res)=>res.json({ok:true,app:"ReWear"}));
app.get("/api/me",(req,res)=>{const u=currentUser(req);res.json({user:u?publicUser(u):null})});
app.post("/api/register",async(req,res)=>{
 const {name,email,password,city}=req.body||{};
 if(!name||!email||!password||!city)return res.status(400).json({error:"Please complete all fields."});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"Enter a valid email address."});
 if(String(password).length<8)return res.status(400).json({error:"Password must contain at least 8 characters."});
 if(users.some(u=>u.email===email.toLowerCase()))return res.status(409).json({error:"An account with this email already exists."});
 const user={id:nextUser++,name:String(name).trim(),email:email.toLowerCase(),password:await bcrypt.hash(password,10),city:String(city).trim(),role:admins.has(email.toLowerCase())?"admin":"user"};
 users.push(user);req.session.userId=user.id;res.status(201).json({user:publicUser(user)});
});
app.post("/api/login",async(req,res)=>{
 const {email,password}=req.body||{};const u=users.find(x=>x.email===String(email||"").toLowerCase());
 if(!u||!await bcrypt.compare(password||"",u.password))return res.status(401).json({error:"Email or password is incorrect."});
 req.session.userId=u.id;res.json({user:publicUser(u)});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/items",(req,res)=>{
 let result=items.filter(i=>i.status==="available");
 const q=String(req.query.q||"").toLowerCase(),category=String(req.query.category||"All"),city=String(req.query.city||"All"),size=String(req.query.size||"All");
 if(q)result=result.filter(i=>[i.title,i.brand,i.category,i.city,i.description].some(s=>s.toLowerCase().includes(q)));
 if(category!=="All")result=result.filter(i=>i.category===category);
 if(city!=="All")result=result.filter(i=>i.city.toLowerCase()===city.toLowerCase());
 if(size!=="All")result=result.filter(i=>i.size.toLowerCase()===size.toLowerCase());
 res.json(result.map(safeItem));
});
app.get("/api/items/:id",(req,res)=>{const item=items.find(i=>i.id===Number(req.params.id));if(!item)return res.status(404).json({error:"Item not found."});res.json(safeItem(item))});
app.post("/api/items",auth,(req,res)=>{
 const {title,category,size,brand,condition,value,city,image,description}=req.body||{};
 if(!title||!category||!size||!brand||!condition||!city||!description)return res.status(400).json({error:"Complete all required listing fields."});
 const val=Number(value);if(!Number.isFinite(val)||val<0||val>100000)return res.status(400).json({error:"Enter a valid estimated swap value."});
 const item={id:nextItem++,title:String(title).trim(),category,size,brand,condition,value:val,city:String(city).trim(),ownerId:currentUser(req).id,ownerName:currentUser(req).name,image:image||"https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85",description:String(description).trim(),status:"available"};
 items.unshift(item);res.status(201).json(item);
});
app.delete("/api/items/:id",auth,(req,res)=>{const item=items.find(i=>i.id===Number(req.params.id));if(!item)return res.status(404).json({error:"Item not found."});if(item.ownerId!==currentUser(req).id&&currentUser(req).role!=="admin")return res.status(403).json({error:"You can only remove your own listing."});item.status="removed";res.json({ok:true})});
app.get("/api/requests",auth,(req,res)=>{const u=currentUser(req);res.json(requests.filter(r=>r.fromUserId===u.id||r.toUserId===u.id).map(r=>({...r,offeredItem:items.find(i=>i.id===r.offeredItemId),targetItem:items.find(i=>i.id===r.targetItemId)})))});
app.post("/api/requests",auth,(req,res)=>{
 const u=currentUser(req),{targetItemId,offeredItemId,message}=req.body||{};
 const target=items.find(i=>i.id===Number(targetItemId)&&i.status==="available"),offered=items.find(i=>i.id===Number(offeredItemId)&&i.status==="available"&&i.ownerId===u.id);
 if(!target)return res.status(404).json({error:"That item is no longer available."});
 if(target.ownerId===u.id)return res.status(400).json({error:"You cannot request a swap for your own item."});
 if(!offered)return res.status(400).json({error:"Choose one of your available listings to offer."});
 if(requests.some(r=>r.fromUserId===u.id&&r.targetItemId===target.id&&r.status==="pending"))return res.status(409).json({error:"You already have a pending request for this item."});
 const r={id:nextRequest++,fromUserId:u.id,fromName:u.name,fromCity:u.city,toUserId:target.ownerId,targetItemId:target.id,offeredItemId:offered.id,message:String(message||"Hi! Would you like to swap?").slice(0,500),status:"pending",createdAt:new Date().toISOString(),chat:[]};
 requests.unshift(r);res.status(201).json(r);
});
app.patch("/api/requests/:id",(req,res)=>{
 const r=requests.find(x=>x.id===Number(req.params.id));if(!r)return res.status(404).json({error:"Request not found."});
 const u=currentUser(req);if(!u||(u.id!==r.fromUserId&&u.id!==r.toUserId))return res.status(403).json({error:"You are not part of this request."});
 const {status}=req.body||{};if(!["accepted","rejected","cancelled","completed"].includes(status))return res.status(400).json({error:"Invalid request status."});
 if(status==="accepted"&&u.id!==r.toUserId)return res.status(403).json({error:"Only the item owner can accept this request."});
 if(status==="completed"&&r.status!=="accepted")return res.status(400).json({error:"Only accepted swaps can be completed."});
 r.status=status;r.updatedAt=new Date().toISOString();
 if(status==="completed"){const a=items.find(i=>i.id===r.targetItemId),b=items.find(i=>i.id===r.offeredItemId);if(a)a.status="swapped";if(b)b.status="swapped";}
 res.json(r);
});
app.get("/api/requests/:id/messages",auth,(req,res)=>{const r=requests.find(x=>x.id===Number(req.params.id));const u=currentUser(req);if(!r)return res.status(404).json({error:"Request not found."});if(u.id!==r.fromUserId&&u.id!==r.toUserId)return res.status(403).json({error:"Not allowed."});res.json(messages.filter(m=>m.requestId===r.id))});
app.post("/api/requests/:id/messages",auth,(req,res)=>{const r=requests.find(x=>x.id===Number(req.params.id)),u=currentUser(req);if(!r)return res.status(404).json({error:"Request not found."});if(u.id!==r.fromUserId&&u.id!==r.toUserId)return res.status(403).json({error:"Not allowed."});const body=String(req.body.message||"").trim();if(!body||body.length>1000)return res.status(400).json({error:"Message must contain 1–1000 characters."});const m={id:nextMessage++,requestId:r.id,userId:u.id,userName:u.name,message:body,createdAt:new Date().toISOString()};messages.push(m);res.status(201).json(m)});
app.get("/api/admin/stats",adminOnly,(req,res)=>res.json({users:users.length,activeListings:items.filter(i=>i.status==="available").length,requests:requests.length,completed:requests.filter(r=>r.status==="completed").length,items:items.map(safeItem),usersList:users.map(publicUser),requestsList:requests}));
app.patch("/api/admin/items/:id",adminOnly,(req,res)=>{const i=items.find(x=>x.id===Number(req.params.id));if(!i)return res.status(404).json({error:"Item not found."});i.status=req.body.status==="available"?"available":"removed";res.json(i)});
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`ReWear running at http://localhost:${PORT}`));
