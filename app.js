require('dotenv').config()
const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require("passport");
const session = require('express-session');
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://127.0.0.1:27017/bankDB');

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  name: String,
  picture: String,
  balance: Number
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/bank",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
  function (accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({ username: profile.emails[0].value, googleId: profile.id, name: profile.displayName, picture: profile.photos[0].value }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", (req, res) => {
  res.render("home")
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile", "email"] })
);

app.get("/auth/google/bank",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/bank");
  });

app.get("/login", (req, res) => {
  res.render("login");
})

app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/logout", function (req, res) {
  req.logout;
  res.redirect("/");
});

app.get("/bank", (req, res) => {
  if (req.isAuthenticated()) {
    User.findById(req.user)
      .then(function (foundUser) {
        console.log(req.user);
        res.render("bank", { user: foundUser });
      })
      .catch(function (err) {
        console.log(err);
      });
  } else {
    res.redirect("/login");
  }
})

app.post("/addMoney", (req, res) => {
  User.findByIdAndUpdate(req.user, { $inc: { balance: req.body.moneyAdd } })
    .then((foundUser) => {
      res.redirect("/bank");
    });
});

app.post("/sendMoney", (req, res) => {
  User.findOneAndUpdate({ googleId: req.body.accNumber }, { $inc: { balance: req.body.moneySend } })
    .then(() => {
      User.findByIdAndUpdate(req.user, { $inc: { balance: -req.body.moneySend } })
        .then((foundUser) => {
          res.redirect("/bank");
        });
    })
})

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        console.log(req.user);
        res.redirect("/bank");
      });
    }
  })
})

app.post("/register", (req, res) => {
  User.register({ username: req.body.username }, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/bank");
      });
    }
  });
})

app.listen(3000, () => {
  console.log('Server Started on PORT 3000');
})