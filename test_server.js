var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));

var port = 9000;

app.get('/error1', function(req, res) {
    res.send(500, 'error')
});

app.get('/error2', function(req, res) {
    res.send(500, 'error')
});

app.get('/ok', function(req, res) {
    res.end('ok')
});

app.listen(port);
console.log('listening on port %d', port);
