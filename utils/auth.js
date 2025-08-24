import jwt from "jsonwebtoken";
const secret = "$uperman@123";


function createtokenforuser(user){
    const payload = {
        _id:user._id,
        email:user.email,
        googleId:user.googleId,

    };
    const token = jwt.sign(payload,secret);
    return token;
}


function validatetoken(token){
    const payload = jwt.verify(token,secret);
    return payload;
}

module.exports = {
    createtokenforuser,validatetoken,

}