import imgur from "imgur"
import path from 'path'
import fs, { createReadStream } from "fs";

export let checker = (val1,val2) =>{
    if (val1!=val2) {
      return false;
    }
    return true;
  }


export let maxminfinder = (user1,user2) =>{
    let great = user1>=user2?user1:user2;
    let small = user1==great?user2:user1;
    return {great,small}
  }


export const fileuploader = async(fl) =>{
  let samplefile = fl.files;
  let pat = "/file/" +Number(new Date())+'-'+ samplefile.name;
  let uploadfilepath = path.resolve() + pat
  await samplefile.mv(uploadfilepath,(err)=>{

    if (err) {
    throw err
    }
  })

        // imgur client id = dad3dba4438c4f5
          // client secret = 21acb720b32c053a15447a43d899dc330dc0d49c



    const client = new imgur({ clientId: "dad3dba4438c4f5" });
    const response = await client.upload({
        image: createReadStream('.'+pat),
        type: 'stream',
      });
          
    let imgdata = response.data
    fs.unlinkSync(uploadfilepath)  

return {profileimage:imgdata.link,deletehash:imgdata.deletehash}

}