var mongoose = require("mongoose");

var campsiteSchema = new mongoose.Schema({
   name: String,
   image: String,
   imageId : String,
   description: String,
   author: 
   {
      id : 
      {
         type : mongoose.Schema.Types.ObjectId,
         ref : "User"
      },
      username : String
   },
   location : String,
   features: [String],
   activities: [String],
   comments: [
   {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment"
   }
   ]
});

module.exports = mongoose.model("Campsite", campsiteSchema);