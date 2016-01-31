// Dependencies
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json());
var exphbs = require('express-handlebars');

// Templating options
//app.engine('hbs', expressHbs({ extname:'hbs', defaultLayout:null }));

app.set('views', './views');

var hbs = exphbs.create({
    // Specify helpers which are only registered on this instance.
    helpers: {
        equal: function(lvalue, rvalue, options) {
	      if (arguments.length < 3)
	          throw new Error("Handlebars Helper equal needs 2 parameters");
	      if( lvalue!=rvalue ) {
	          return options.inverse(this);
	      } else {
	          return options.fn(this);
	      }
		},
        compare: function (v1, operator, v2, options) {
        	if (arguments.length < 4)
        		throw new Error("Handlebars Helper compare needs 3 parameters");
        	
        	switch(operator) {
        		case ">=":
        			return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        		case "<=":
        			return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        	}
        },
        and: function (v1, v2) {
        	return v1 && v2;
    	},
    	lt: function(v1, v2) {
    		return v1 < v2;
    	},
    	lte: function (v1, v2) {
        	return v1 <= v2;
    	},
    	mte: function(v1, v2) {
    		return v1 >= v2;
    	}

    }
});

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

// Map URL, so it can be accessed from Jade file
app.use("/assets", express.static(__dirname + '/assets'));

// Our modules
var calc = require('./group_modules/calc.js');
var info = require('./group_modules/info.js');
var check = require('./group_modules/check.js');
var util = require('./group_modules/util.js');
var globals = require('./group_modules/globals.js');

// Data files
var restaurants = require('./data/restaurants.json');
var activities = require('./data/activities.json');
var transport = require('./data/transport.json');
var users = require('./data/users.json');


var messages = {
	"no_results" : "No results found.",
	"file_not_recognised" : "File not recognised",
	"id_not_recognised" : "User ID not recognised"
};

// Routes

// GET FILES
app.get('/api/:file', function(req, res) {
	if (!check.isDefined([req.params.file])) {
		res.end(messages.not_recognised);
		return;
	}
	var file = req.params.file;

	switch(file) {
		case 'restaurants':
			res.end(JSON.stringify(restaurants));
			return;
		case 'activities':
			res.end(JSON.stringify(activities));
			return;
		case 'transport':
			res.end(JSON.stringify(transport));
			return;
		case 'users':
			res.end(JSON.stringify(users));
			return;
		default:
			res.end(messages.not_recognised);
			return;
	}

});

// GET CHEAPEST
app.get('/api/cheapest/:file', function(req, res) {
	if (!check.isDefined([req.params.file])) {
		res.end(messages.not_recognised);
		return;
	}

	var file = req.params.file;
	var cheapest = calc.cheapest(file, res);

	if (cheapest.length) {
		res.end(JSON.stringify(cheapest));
	}

	res.end(messages.not_found);
});

//LIST ALL ENTITIES IN FILE
app.get('/api/entities/:file', function(req, res){

	if (!check.isDefined([req.params.file])){
		res.end(messages.not_recognised);
		return;
	}
	var file = req.params.file;
	var entities = info.allEntities(file, res);

	if (entities.length) {
		res.end(JSON.stringify(entities));
	}

	res.end(messages.not_found);
});

// GET ENTITY BY SERVICE
app.get('/api/services/:file/:service', function(req, res) {
	if (!check.isDefined([req.params.file, req.params.service])) {
		res.end(messages.not_recognised);
		return;
	}

	var file = req.params.file;
	var service = req.params.service;
	res.end(JSON.stringify(calc.service_match(file, service, res)));
});

// GET USER PROFILE
app.get('/api/users/:uid', function(req, res) {
	var uid = req.params.uid;
	if (!check.isDefined([uid])) {
		res.end(JSON.stringify(info.getUsers()));
	}

	res.end(JSON.stringify(info.getUser(uid)));
});


// GET USER ACTIVITY
app.get('/api/users/:uid/:file', function(req, res) {
	if (!check.isDefined([req.params.uid, req.params.file])) {
		res.end(messages.not_recognised + " " + messages.id_not_recognised);
	}

	var uid = req.params.uid;
	var file = req.params.file;

	var returnResults = info.userActivity(uid, file);
	if (returnResults.length) {
		res.end(JSON.stringify(returnResults));
	}
	else {
		res.end(JSON.stringify(messages.no_results));
	}
});

// GET BRAND COUNT FOR USER.
app.get('/api/users/:uid/:file/:brandid', function(req, res) {
	if (!check.isDefined([req.params.uid, req.params.file, req.params.brandid])) {
		res.end(messages.not_recognised + " " + messages.id_not_recognised);
	}

	var uid = req.params.uid;
	var file = req.params.file;
	var brandid = req.params.brandid;

	var returnResults = calc.getBrandCount(uid, file, brandid);
	if (returnResults.length) {
		res.end(JSON.stringify(returnResults));
	}
	else {
		res.end(JSON.stringify(messages.no_results));
	}
});



// RECOMMENDER ROUTES
// (a) Recommend for specific sector
app.get('/api/recommend/:uid/:location/:file', function(req, res) {
	if (!check.isDefined([req.params.uid, req.params.file, req.params.location])) {
		res.end(messages.not_recognised + " " + messages.id_not_recognised);
	}

	var recommended = calc.recommend(req.params.uid, req.params.file, req.params.location);
	res.end(JSON.stringify(recommended));
});

// (b) Recommend for all sectors
app.get('/api/recommend/all/:uid/:location/html', function(req, res) {
	if (!check.isDefined([req.params.uid, req.params.location])) {
		res.end(messages.not_recognised + " " + messages.id_not_recognised);
	}


	// Get all recommendations
	var recommendedRest = calc.recommend(req.params.uid, 'restaurants', req.params.location);
	var recommendedTrans = calc.recommend(req.params.uid, 'transport', req.params.location);
	var recommendedActiv = calc.recommend(req.params.uid, 'activities', req.params.location);

	// Nullify arrays, so template engine will default to "else" when attempting "each"
	if (Object.keys(recommendedRest[0]).length === 0) recommendedRest = null;
	if (Object.keys(recommendedTrans[0]).length === 0) recommendedTrans = null;
	if (Object.keys(recommendedActiv[0]).length === 0) recommendedActiv = null;

	// Render recommendations partial
	res.render('recommendations', {
		restaurants: recommendedRest,
		transport: recommendedTrans,
		activities: recommendedActiv
	});


});


// CLIENT - UI
app.get('/api/', function(req, res) {
	var users = info.getUsers();
	var userList = [];
	// Remove numeric keys from JSON, e.g. "1"
	Object.keys(users).forEach(function(user) {
		var u = users[user];
		userList.push(u);
	});

	res.render('test', {
		users: users
	});
});


// Start server
var server = app.listen(3000, function() {
	var host = server.address().address;
	var port = server.address().port;

	console.log("Recommender System API listening at http://%s:%s", host, port);
});
