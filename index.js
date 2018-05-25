var express = require("express");
var router = express.Router();
var passport = require("passport");
var Campsite = require ("./models/campsite");
var Comment = require ("./models/comment");
var User = require("./models/user");

//Homepage, Search
router.get("/", function(req,res){
	let noMatch = null;
	if (req.query.search) {
		const regex = new RegExp(escapeRegex(req.query.search), 'gi');
		Campsite.find({location: regex}, function(err, allCampsites) {
			
			if (allCampsites.length < 1) {
				noMatch = "No campgrounds found, please try again.";
			}
			camp = { 
				campsites: allCampsites,
				page: "campsites"
			}
			res.render("campsite-index", camp);  
			
		});
	} else {
    // Get all camgrounds from DB
    Campsite.find({}, function(err, allCampsites) {


    	camp = { 
    		campsites: allCampsites,
    		page: "campsites"
    	}
    	res.render("campsite-index", camp);  
    	
    }); 
}
});  



// Get request for Logging in
router.get("/login", function(req,res){
	res.render("login");
});

// POST request for Logging in
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => { //Local authentication by passport
    if (!user) { //If user not found
    	return res.redirect("/login");
    }
    req.logIn(user, err => { //Once user is found
    	let redirectTo = req.session.redirectTo ? req.session.redirectTo : '/campsites';
    	delete req.session.redirectTo;
    	res.redirect(redirectTo);
    });
})(req, res, next);
});



//GET request for registering a new user
router.get("/register", function(req, res){
	res.render("register");
});

//POST request for registering a new user
router.post("/register", function(req, res){
	var newUser = new User({
		firstName : req.body.firstName ,
		lastName : req.body.lastName,
		email : req.body.email,
		username: req.body.username});

	var userPassword = req.body.password;

	User.register(newUser, userPassword, function(err, user){
		
		passport.authenticate("local")(req, res, function(){ //Passport local authentication
			res.redirect("/campsites"); 
		});
	});
});


//GET request for logging out
router.get("/logout", function(req, res){
	req.logout();
	res.redirect("/campsites");
});




//Uploading image
//Attribution : https://stackoverflow.com/questions/35635165/upload-images-to-node-js-using-multer-doesnt-work
var multer = require('multer');
var storage = multer.diskStorage({
	filename: function(req, file, callback) {
		callback(null, Date.now() + file.originalname);
	}
});

var imageFilter = function (req, file, cb) {
	if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) { //Only supported formats
		return cb(new Error('Only image files are allowed!'), false); //If any other format, it throws an error
	}
	cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})

var cloudinary = require('cloudinary'); //Cloudinary is used to host images online once uploaded
cloudinary.config({ 
	cloud_name: 'hiddencampers', 
	api_key: 311281915568112, 
	api_secret: "EWWuFEZzy5wRLW-T4KszRouxdxg"
});


//GET request for viewing list of campsites on homepage
router.get("/campsites", function(req,res){
	if (req.query.search){
		const regex = new RegExp(escapeRegex(req.query.search), 'gi'); //Search function, defined at the end of file
		Campsite.find({location : regex}, function(err, allCampsites){
			
			newCampsiteList = {
				campsites : allCampsites,
				currentUser : req.user
			};
			res.render("campsite-index", newCampsiteList);
		});
	}
	else
	{
		Campsite.find({}, function(err, allCampsites){
			
			newCampsiteList = {
				campsites : allCampsites,
				currentUser : req.user
			};
			res.render("campsite-index",newCampsiteList);
		});
	}
});


//GET request for adding a campsite
router.get("/campsites/add", isLoggedIn, function(req,res){
	if(isLoggedIn) {
		res.render("campsite-new");
	}
	else {
		res.render("/login");
	}
	
});

//Creating a new campsite, POST
router.post("/campsites", isLoggedIn, upload.single('image'), function(req, res) {
	cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
		if(err) {
			
			return res.redirect('back');
		}
		req.body.campsite.image = result.secure_url;
		req.body.campsite.imageId = result.public_id;
		req.body.campsite.author = {
			id: req.user._id,
			username: req.user.username
		}
		Campsite.create(req.body.campsite, function(err, campsite) {
			if (err) {

				return res.redirect('back');
			}
			res.redirect('/campsites/' + campsite.id);
		});
	});
});

// Show campsite
router.get("/campsites/:id", function(req,res){
	Campsite.findById(req.params.id).populate("comments").exec(function(err, foundCampsite){
		
		camp = {
			campsite : foundCampsite
		};
		res.render("campsite-show", camp);
		
	});
});


//Editing a campsite
router.get("/campsites/:id/edit", campsiteOwnershipAuthentication,  function(req, res){
	Campsite.findById(req.params.id, function(err, foundCampsite){
		camp = {
			campsite : foundCampsite
		};
		res.render("campsite-edit", camp);
	});
});


//Updating a campsite
router.put("/campsites/:id", upload.single('image'), function(req, res){
	Campsite.findById(req.params.id, async function(err, campsite){
		
		if (req.file) {
			try {
				await cloudinary.v2.uploader.destroy(campsite.imageId);
				var result = await cloudinary.v2.uploader.upload(req.file.path);
				campsite.imageId = result.public_id;
				campsite.image = result.secure_url;
			} catch(err) {
				req.flash("error", err.message);
				return res.redirect("back");
			}
		}
		campsite.name = req.body.campsite.name;
		campsite.description = req.body.campsite.description;
		campsite.location = req.body.campsite.location;
		campsite.features = req.body.campsite.features;
		campsite.activities = req.body.campsite.activities;
		campsite.save();
		req.flash("success","Successfully Updated!");
		res.redirect("/campsites/" + campsite._id);
		
	});
});


//Deleting a campsite
router.delete('/campsites/:id', function(req, res) {
	Campsite.findById(req.params.id, async function(err, campsite) {
		
		try {
			await cloudinary.v2.uploader.destroy(campsite.imageId);
			campsite.remove();
			req.flash('success', 'Campsite deleted successfully!');
			res.redirect('/campsites');
		} catch(err) {
			if(err) {
				req.flash("error", err.message);
				return res.redirect("back");
			}
		}
	});
});


//Authentication to verify if the user is a campsite's owner
function campsiteOwnershipAuthentication(req, res, next){
	if(req.isAuthenticated()){
		Campsite.findById(req.params.id, function(err, foundCampsite){
			if(err){
				res.redirect("back");
			}  else {
				if(foundCampsite.author.id.equals(req.user._id)) {
					next();
				} else {
					res.redirect("back");
				}
			}
		});
	} else {
		res.redirect("back");
	}
}


//Attribution : https://stackoverflow.com/questions/432493/how-do-you-access-the-matched-groups-in-a-javascript-regular-expression
//				https://stackoverflow.com/questions/3115150/how-to-escape-regular-expression-special-characters-using-javascript
function escapeRegex(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};







//***************** Comments ********************

//New comment, GET
router.get("/campsites/:id/comments/new", isLoggedIn, function(req,res){
	Campsite.findById(req.params.id, function(err, foundCampsite){

		camp = {
			campsite : foundCampsite
		};
		res.render("comment-new", camp);
		
	})
});


//New comment, POST
router.post("/campsites/:id/comments/", isLoggedIn, function(req, res){
	Campsite.findById(req.params.id, function(err, campsite){
		
		Comment.create(req.body.comment, function(err, comment){
			if (err)
			{
				console.log(err);
			}
			else
			{

				comment.author.id = req.user._id;
				comment.author.username = req.user.username;
				comment.save();
				campsite.comments.push(comment);
				campsite.save();
				res.redirect("/campsites/" + campsite._id);
			}
		});
		

	});
});


//Editing a comment
router.get("/campsites/:id/comments/:comment_id/edit", commentOwnershipAuthentication , function(req, res){
	Comment.findById(req.params.comment_id, function(err, foundComment){
		
		camp = {
			campsite_id : req.params.id,
			comment: foundComment
		};
		res.render("comment-edit", camp);

		
	});
});


//Updating a Comment
router.put("/campsites/:id/comments/:comment_id", commentOwnershipAuthentication, function(req, res){
	Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
		
		res.redirect("/campsites/" + req.params.id);
		
	});
});

//Deleting a Comment
router.delete("/campsites/:id/comments/:comment_id", commentOwnershipAuthentication,  function(req, res){
	Comment.findByIdAndRemove(req.params.comment_id, function(err){
		
		res.redirect("/campsites/" + req.params.id);
		

	});
});




//Authentication to verify if the comment's owner is the user
function commentOwnershipAuthentication(req, res, next){
	if(req.isAuthenticated()){
		Comment.findById(req.params.comment_id, function(err, foundComment){
			if(err){
				res.redirect("back");
			}  else {
				if(foundComment.author.id.equals(req.user._id)) {
					next();
				} else {
					res.redirect("back");
				}
			}
		});
	} else {
		res.redirect("back");
	}
}



router.get("/user/:id", function(req,res){
	
	User.findById(req.params.id).exec(function(err, foundUser){
		

		Campsite.find().where("author.id").equals(foundUser._id).exec((err, allCampsites) => {

			
			camp = {
				campsites : allCampsites,
				user : foundUser
			};
			res.render("userProfile", camp);

			
		});
		
	});
});



//Authentication to verify if the user is logged in
function isLoggedIn(req, res, next){
	if(req.isAuthenticated()){
		return next();
	}
	req.flash("error", "You need to be logged in to do that!");
	res.redirect("/login");
}

module.exports = router;