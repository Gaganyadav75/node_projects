import express, { response } from "express"
import http from 'http'
import { Server } from "socket.io";
import bodyParser from 'body-parser';
import cors from 'cors'
import mysql from 'mysql2/promise'
import path from "path";
import imgur from "imgur" 
import fs,{createReadStream} from "fs"
import expressfileUpload from "express-fileupload"
import axios from 'axios'
import { ImgurClient } from 'imgur';

import { fileuploader } from "./functions.js";


// all functions imports

import { checker , maxminfinder} from "./functions.js";
import { measureMemory } from "vm";

const app = express();


// app.use(bodyParser.json());

const server = http.createServer(app);



app.use(bodyParser.urlencoded({ extended: true }));


app.use(express.json());
app.use(express.urlencoded({extended:true}))


app.use(cors())
app.use(expressfileUpload())






const pool = mysql.createPool({
  host: "sql6.freesqldatabase.com",
  user: "sql6684487",
  password: "We6UhgYpqI",
  database: "sql6684487",
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
  idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
});


let createnewuser =  async (data) =>{
  let date = Number(new Date())

  let res = false;
    await pool.query(
      "insert into usersinfo values(?,?,?,?,?,?,?,?,?)",
      [data.name,data.gender,data.phone,data.email,data.password,date,data.profileimage,data.deletehash,data.uid]
    ).then(async(response)=>{
      await pool.query(
        "insert into statusinfo (phone , status , token) values(?,?,?) ",
        [data.phone,"offline",""]
      )
      return res = true
    }).catch((err)=>
    {
      // console.log(err);
     return res = false;
    }
    )
    return res =false

}


let check_user_existance = async (phone,password) =>{
  let res ={status: "user not found"};
  await pool.query(
    "select * from usersinfo where (phone = ? or email = ?)",
    [phone ,phone]
  ).then((response)=>{
    if (response[0].length>0) {
      let rs= response[0][0]
      if (rs.password==password) {
        return res = response[0][0]
      }
     return res = {status:"wrong password" } 
    }
  }).catch((err)=>
  {
   return res = {status:err.sqlMessage};
  }
  )

  return res;
}





let inboxsetter = async (user1,user2,lastMessage,lastMessageuser,message_seen) =>{
let {great,small} = maxminfinder(user1,user2);
let inbid = great+small
  await pool.query(
    "insert into inboxinfo (inbox_id,user1,user2,last_message,last_message_user,message_seen) values(?,?,?,?,?,?)",
    [inbid,user1,user2,lastMessage,lastMessageuser,message_seen]
  ).then(async(res)=>{
      
    return true
  }).catch(err=>{
    return false
  })

}


let setMessages = async (inbox_id,messages,messageuser,created_at) =>{
  // console.log(inbox_id,messages,messageuser);
  await pool.query(
    "insert into messages values(?,?,?,?)",
    [inbox_id,messages,messageuser,created_at]
  ).then((res)=>{

    return res

  })
}

let messageGetter = async (inbox_id) =>{
  let rs = [];
  await pool.query(
    " select * from messages where inbox_id = ?",
    [inbox_id]
  ).then((res)=>{
    return rs =res[0]
  }).catch (err=>{console.log(err);})
  return rs;
}




let allseenunseeninboxesgetter = async (user) =>{
 return await pool.query(
    "select * from inboxinfo where user1 = ? or user2 = ?",
    [user,user]
  ).then(res =>{
    // console.log(res[0]);
    return res[0]
  }).catch(err=> err)
}


let lastseensetter = async (last_message,last_message_user,seen,id) =>{

  await pool.query(
    "update inboxinfo set last_message = ? , last_message_user = ? , message_seen = ? where inbox_id = ? ",
    [last_message,last_message_user,seen,id]
  ).then((res)=>{
    return res[0]
  }).catch(err=>err)
}




let statusfinder = async (phone)=>{
 return await pool.query(
    "select * from statusinfo where phone = ? ",
    [phone]
  ).then(res=>{
    if (res[0].length!=0) {
    return res[0][0].status
    }
    else{
      return false
    }
  }).catch(err=>false)
}


let statussetter =async (phone,status) =>{
  await pool.query(
    "update statusinfo set status = ? where phone = ?",
    [status,phone]
  ).then((res)=>{
    return res[0]
  }).catch(err=>false)
}


let connamefinder = async(user) =>{
  return await pool.query(
    "select * from usersinfo where phone = ?",
    [user]
  ).then((res) =>{
    return {name:res[0][0].name,profileimage:res[0][0].profileimage};
  }).catch(err=> "unknown")
}



let contactlistfinder = async (user) =>{

  let allinbox = await allseenunseeninboxesgetter(user);
  // console.log(allinbox);
  let dt = [];
  for (let i = 0; i < allinbox.length; i++) {
    let ele = allinbox[i];
    // console.log(ele);
  let con = ele.user1;
    if (ele.user1==user) {
      con = ele.user2
    }
    let st = await statusfinder(con)
    let {name,profileimage} = await connamefinder(con);
    dt.push({name: name,phone:con,status:st,lastMessage:ele.last_message,last_message_user:ele.last_message_user,seen:ele.message_seen,profileimage:profileimage})
  }

return dt
}


let deletemessage = async (inbid,time) =>{
  await pool.query(
    "delete from messages where inbox_id = ? and created_at = ?",
    [inbid,time]
  )

}


let uidchecker = async (uid) =>{
  return await pool.query(
    "select * from usersinfo where uid = ?",
    [uid]
  ).then(res=>res[0].length==0?false:true).catch(err=>false)
}


let seensetter = async(id,val) =>{
  await pool.query(
    "update inboxinfo set message_seen = ? where inbox_id = ?",
    [val,id]
  ).then((res)=>{
    return true
  }).catch(err=>false)
}


const io = new Server(server,{
  cors: {
      origin: 'https://reactmessageapp.onrender.com',
      methods: ['GET', 'POST'],
    },
});





app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://reactmessageapp.onrender.com");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
next();
});





io.on('connect', (socket) => {
    console.log(`User connected ${socket.id}`);
    
socket.on("joinroom",async (data)=>{
    if ("user1" in data && "uid" in data) {
     
      let usr = await uidchecker(data.uid)
      // console.log(usr);
      if (usr) {
        socket.join(data.user1);
        console.log("user joined");
        statussetter(data.user1,"online")
        let cont = await contactlistfinder(data.user1);
        cont.forEach(cl=>{
          // console.log(cl);
        io.to(cl.phone).emit("status",{status:"online",phone:data.user1});
        })
        // console.log(cont)
        io.to(data.user1).emit("contactinfo",cont);
      }
    }else{
      io.to(data.user1).emit("error","error");
    }
   
  })
   

socket.on("setstatus",async (data)=>{
  let cont = await contactlistfinder(data.phone);
  cont.forEach(cl=>{
    console.log("inside contstatus seter");
    // console.log(cl);
    if (cl.status=="online") {
  io.to(cl.phone).emit("status",data);
    }
  })

  await statussetter(Number(data.phone),data.status)

  })



socket.on("sendmessage", async (data)=>{
    if ("message" in data && "sender" in data && "receiver" in data) {
      
    let {great,small} = maxminfinder(data.sender,data.receiver);
    let inboxid = great+small;
    // console.log(inboxid);
    io.to(data.receiver).emit("receivedmessage",data);

    await setMessages(inboxid,data.message,data.sender,data.created_at);
   await lastseensetter(data.message,data.sender,data.sender,inboxid)


  }
  })



socket.on("needmessages",async(data)=>{
  
  // console.log(data);
let {great,small} = maxminfinder(data.user1,data.user2);
let inbox_id = String(great)+String(small)
  let mstosend = await (await messageGetter(inbox_id)).map(ele=>{return {message:ele.message,sender:ele.message_user,created_at:ele.created_at
    }})

  io.to(data.user1).emit("messagesforuser2",{user2:data.user2,messages:mstosend})
  })


socket.on("deletemessage",async(data)=>{
  if ("created_at" in data && "user1" in data && "user2" in data) {
  io.to(data.user2).emit("msgdeleted",{user1:data.user2,user2:data.user1,created_at:data.created_at})

    let {great,small} = maxminfinder(data.user1,data.user2)
    let inbid = String(great)+String(small);
    await deletemessage(inbid,data.created_at)
    // console.log("deleted");
  }
})


// app.post("/send/image",(req,res) =>{
//   // console.log(path.resolve());

//   console.log(req.body);
//     if (!req.data) {
//       return res.status(500).send("no files")
//   }
//   // console.log(req.files)

  
//   let samplefile = req.data.samplefile;
//   // console.log(samplefile);

  
//   let uploadfilepath = path.resolve() + "/file/" + samplefile.name;

//   samplefile.mv(uploadfilepath,(err)=>{
//       if (err) {
//       return res.status(500).send(err)
//       }

//   res.send("hii")

//       // imgur.uploadFile(uploadfilepath).then((urlobject)=>{
//       //   socket.emit("receiveimage",{url:urlobject.data.link,deletehash:urlobject.data.deletehash})
//       //   // console.log(urlobject);
//       //   res.send("hii")
//       //     fs.unlinkSync(uploadfilepath)
//       // })
//   })

//   })

socket.on("seenset",(data)=>{
  // console.log(data);
  if ("user1" in data && "user2" in data) {
    let {great,small} = maxminfinder(data.user1,data.user2);
    let inboxid = great+small;
    seensetter(inboxid,data.seen)
  }
 
    
})




   socket.on('disconnect', (data) => {
    console.log('User Disconnected' + socket.id);
  });
  
});

// io.on("disconnect",(data)=>{
//   // console.log(data);
//     console.log("user disconnected");
//   })


app.post("/add/contact",async (req,res)=>{
   let data = req.body;
    
    let r = await inboxsetter(data.user1,data.user2,"Added",data.user1,data.user1)
    // console.log("contact added");
    res.send(r)
  })



app.post("/search/user",async (req,res)=>{
  // console.log("search");
    let data = req.body
    let udata = await connamefinder(data.phone)
    // console.log(udata);
    res.send(udata)
  })


app.post("/user/check",async (req,res)=>{
  let data = req.body;
  
  res.send(await uidchecker(data.uid))
  // res.send(false)

})







app.post("/create/new-user",async (req,res)=>{
    // console.log(req.files);
      let data = req.body;

      let fl = req.files;


      let userexists = await uidchecker(data?.uid)
   

      if (!userexists && "uid" in data && "name" in data && "password" in data && "phone" in data && data.phone.length ==10) {
      
      if (fl!=null) {
       let uploaddata = await fileuploader(fl);
       if (uploaddata.profileimage != undefined && uploaddata.deletehash != undefined) {
            await createnewuser({...data,...uploaddata})
          return  res.send(true)

       }else{
          res.status(500).send(false)
       }
      }else{
          let g = data.gender
          if (g=="male") {
            fl = "https://i.imgur.com/byT90Bu.png"
          }else if(g =="female"){
            fl ="https://i.imgur.com/LeTHAg7.png"
          }else{
            fl = "https://i.imgur.com/ZNYCzx5.png"
          }
          await createnewuser({...data,profileimage:fl,deletehash:"none"})
         res.send(true)
      }


      }

      // console.log("user created");

 
  })


app.post("/login/user",async (req,res)=>{
    let data = req.body;
    console.log(data);
  if ("password" in data && "phone" in data) {

    let dddd= await check_user_existance(data.phone,data.password);
    if ("uid" in  dddd) {
      let {name,phone, gender,profileimage,uid} =  dddd
      res.send({name,phone,gender,profileimage,uid})
    }else{
      res.send(dddd)
    }

  }else{
    res.send("error")
  }
      
  });


app.all('*',(req,res)=>{
  res.render()
  })

server.listen("5000",()=>{
    console.log("server started");
})
