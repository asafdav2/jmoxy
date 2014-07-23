'use strict';

var _ = require('lodash');
var express = require('express');
var fs = require('fs');
var request = require('request');
var url = require('url');


var app = express();

var config = (function() {
    try {
        return JSON.parse(fs.readFileSync('config.json', 'utf8'));
    } catch(e) {
        console.error(e);
        return {
            'hostname' : 'localhost',
            'port' : 9000,
            'listening_port': 8888,
            'rules': []
        };
    }
})();

var rules = config.rules;

var ruleMatchesRequest = function(rule, request) {
    return request.method.toLowerCase() === rule.request.method.toLowerCase() &&
           request.url === rule.request.url;
};


var make_options = function(config, req) {
    return {
        url: url.format({protocol: 'http', hostname : config.hostname, port : config.port, pathname : req.url}),
        method: req.method,
        encoding: 'binary'
    };
};

var loadJson = function(rule, callback) {
    if (rule.hasOwnProperty('jsonFile') && rule.hasOwnProperty('jsonUrl')) {
        callback('both jsonFile and jsonUrl were defined for rule' + rule);
    }
    else if (rule.hasOwnProperty('jsonFile')) {
        fs.readFile(rule.jsonFile, function(error, data) {
            callback(error, data);
        });
    } else if (rule.hasOwnProperty('jsonUrl')) {
        request(rule.jsonUrl, function(error, response, body) {
            callback(error, body);
        });
    }
    else {
        callback('neither jsonFile nor jsonUrl were defined for rule' + rule);
    }
}

var returnByRule = function(res, rule) {
    res.status(rule.response.statusCode).end(rule.response.json);
}

var returnByResponse = function(res, proxy_res, proxy_body) {
    res.status(proxy_res.statusCode);
    res.set(proxy_res.headers);
    res.end(proxy_body);
}


app.all('*', function(req, res) {

    var succeed = function(response) {
        return response.statusCode === 200;
    };

    request(make_options(config, req), function(proxy_err, proxy_res, proxy_body) {
        if (proxy_err) {
            console.error(proxy_err);
            res.end(proxy_err);
        } else {
            if (succeed(proxy_res)) {
                res.set(proxy_res.headers);
                res.end(proxy_body, 'binary');
            } else {
                var rule = _.find(rules, function(rule) {
                    return ruleMatchesRequest(rule, req);
                });
                if (rule) {
                    res.set(rule.response.headers);
                    if (typeof rule.response.json === 'undefined') {
                        loadJson(rule, function(err, json) {
                            if (err) {
                                console.error(err);
                                returnByResponse(res, proxy_res, proxy_body);
                            } else {
                                rule.response.json = json; // cache the json for later calls
                                returnByRule(res, rule);
                            }
                        });
                    } else {
                        returnByRule(res, rule);
                    }
                } else {
                    returnByResponse(res, proxy_res, proxy_body);
                }
            }
        }
    });
});


var server = app.listen(config.listening_port, function() {
    console.log('listening on port %d, proxy to %s:%d', server.address().port, config.hostname, config.port);
});
