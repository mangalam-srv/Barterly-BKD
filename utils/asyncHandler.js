//we are using this so that we dont have to use try catch and handle error everywhere with a special code 
//this is a higher order function so used with ()
const asyncHandler = (requestHandler)=>{
    return (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next))
        .catch((err)=>next(err))
    }

}


export{asyncHandler}