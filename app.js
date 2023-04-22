const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
// const { v4: uuidv4 } = require('uuid');
const { graphqlHTTP } = require('express-graphql');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('./util/file');

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(bodyParser.json());
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // graphql doesn't accept anything other than get/post to bypass options -> we return 200 = success
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(auth);

// We'll have REST API Req to hand the mage to multer
app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    throw new Error('Not Authenticated!');
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No file Provided' });
  }
  if (req.body.oldPath) {
    clearImage(req.body.oldPath);
  }

  return res.status(201).json({
    message: 'File Stored',
    filePath: req.file.path.replace('\\', '/'),
  });
});

app.use(
  '/graphql',
  graphqlHTTP({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    customFormatErrorFn(err) {
      if (!err.originalError) {
        return err;
      }
      const data = err.originalError.data;
      // const message = err.originalError.message;
      const message = err.message || 'An error Occurred';
      const status = err.originalError.code || 500;
      return { message, status, data };
    },
  })
);

app.use(express.static(path.join(__dirname, 'build')));

app.use('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data });
});

mongoose
  .connect(
    'mongodb+srv://ginryo:LYcvrzU7BRLV8nLx@cluster0.spv0bgt.mongodb.net/feed?'
  )
  .then((result) => {
    app.listen(process.env.PORT || 8080);
  })
  .catch((err) => console.log(err));
