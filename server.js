'use strict';
require('dotenv').config();
const YelpAPIUtil = require('./util/yelp_api_helpers');
const express = require('express');
const request = require('request');
const yelp = require('yelp-fusion');
const bodyParser = require('body-parser');
const axios = require('axios');
const qs = require('querystring');
const slackTestFunction = require('./routes.js');
const debug = require('debug')('yelp_on_slack:server');
// const { createMessageAdapter } = require('@slack/interactive-messages');
const client = yelp.client(process.env.YELP_KEY);
const { IncomingWebhook } = require('@slack/client');

// const slackInteractions = createMessageAdapter(process.env.SLACK_VERIFICATION_TOKEN);

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// app.use('/posttest', slackInteractions.expressMiddleware());
app.set('port', process.env.PORT || 5000);

app.get('/', (req, res) => {
  res.json({ hello: "world" });
});

app.get('/auth', (req, res) => {
  // when a team installs our app on their workspace by pressing our "add to slack" button, they will get re-directed to our /auth route with a code they get from the oauth.access website.

  const options = {
    uri: 'https://slack.com/api/oauth.access?code=' +
      req.query.code +
      '&client_id=' + process.env.CLIENT_ID +
      '&client_secret=' + process.env.CLIENT_SECRET,
    method: 'GET'
  };

  // we then take the code, put it in the above options object, and then make a new request to Slack, which authorizes our app to do stuff with the workspace. this is the only time we get access to the workspace's webhook url, slack access token, workspace name, etc. via the body, which we store in JSONresponse.
  request(options, (error, response, body) => {
    const JSONresponse = JSON.parse(body);
    if (!JSONresponse.ok) {
      console.log(JSONresponse);
      res.send("Error encountered: \n" + JSON.stringify(JSONresponse)).status(200).end()
    } else {
      console.log(JSONresponse);
      // res.send("Success!")
      res.send(JSONresponse);
    }
  });
});

// SLACK
app.get('/slacktest', slackTestFunction);

app.post('/posttest', (req, res) => {
  const { token, text, trigger_id} = req.body;

  if (token === process.env.SLACK_VERIFICATION_TOKEN) {
    const dialog = {
      token: process.env.SLACK_ACCESS_TOKEN,
      trigger_id, 
      dialog: JSON.stringify({
        title: 'Create a Poll',
        callback_id: 'submit-form',
        submit_label: 'Submit',
        elements: [
          {
            label: 'Price',
            type: 'select',
            name: 'price_list',
            options: [
              {
                label: "$",
                value: "one$" 
              },
              {
                label: "$$",
                value: "two$"
              },
              {
                label: "$$$",
                value: "three$"
              },
              {
                label: '$$$$',
                value: 'four$'
              }
            ]
          },
          {
            label: 'Distance',
            type: 'select',
            name: 'distance_range',
            options: [
              {
                label: "0.5mi",
                value: 0.5
              },
              {
                label: "1.0mi",
                value: 1.0
              },
              {
                label: "1.5mi",
                value: 1.5
              },
              {
                label: "2.0mi",
                value: 2.0
              }
            ]
          },
          {
            label: 'Location',
            name: "location",
            type: 'text',
            placeholder: 'Starting Location'
          }
        ]
      })
    };

    axios.post('https://slack.com/api/dialog.open', qs.stringify(dialog))
      .then((result) => {
        debug('dialog.open: %o', result.data);
        res.send('All done');
      }).catch((err) => {
        debug('dialog.open call failed: $o', err);
        res.sendStatus(501);
      });
  } else {
    debug('Verification token mismatch');
    res.sendStatus(400);
  }
});



// slackInteractions.action({ type: 'button' }, (payload, respond) => {
//   // console.log(`The user ${payload.user.name} in team ${payload.team.domain} pressed a button`);
//   // console.log(payload);
//   respond({
//     text: 'Thanks for pressing the button, idiot.'
//   });

//   const reply = payload.original_message;
//   delete reply.attachments[0].actions;
//   return reply;
// });
// // app.post('/posttest', slackResponseFunction);


// YELP
app.get('/userrequest', (req, res) => {

  client.search({
    term: 'indian',
    price: [1, 2], // 1 or 2 dollar signs
    location: 'soma, san francisco',
  }).then(response => {
    const filteredResults = response.jsonBody.businesses;

    // logs to server console
    filteredResults.forEach(bus => console.log(bus.name)); 
    res.json(filteredResults);
  });
});

const SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/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";
const webHook = new IncomingWebhook(SLACK_WEBHOOK_URL);

app.get('/restaurants', function (req, res) {
  client.search({
    term: 'asian',
    location: '825 Battery St. San Francisco',
    price: 4,
    sort_by: 'rating'
  }).then(response => {
    console.log(response.jsonBody.businesses);
    const businesses = response.jsonBody.businesses.slice(0, 3);
    restaurantMessage(businesses);
    res.send('Success!');
  });
});

const restaurantMessage = (businesses) => {
  const test = {
    "attachments": [
      YelpAPIUtil.buildRestaurantMessage(businesses[0], 0),
      YelpAPIUtil.buildRestaurantMessage(businesses[1], 1),
      YelpAPIUtil.buildRestaurantMessage(businesses[2], 2)
    ]
  };

  webHook.send(test, function (err, res) {
    if (err) {
      console.log('Error:', err);
    } else {
      console.log('Message successfully sent');
    }
  });
};

app.listen(app.get('port'), () => {
  console.log('App is listening on port ' + app.get('port'));
});