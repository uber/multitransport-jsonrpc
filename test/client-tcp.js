var jsonrpc = require('../lib/index');
var TcpTransport = jsonrpc.transports.client.tcp;
var shared = require('../lib/transports/shared/tcp');
var net = require('net');

exports.loopback = function(test) {
    test.expect(1);
    var server = net.createServer(function(con) {
        var buffer = new Buffer('');
        var messageLen = 0;
        con.on('data', function(data) {
            buffer = Buffer.concat([buffer, data]);
            if(messageLen === 0) messageLen = shared.getMessageLen([data]);
            if(buffer.length === messageLen + 4) {
                con.write(buffer);
                con.end();
            }
        });
    });
    server.listen(23456);
    var tcpTransport = new TcpTransport('localhost', 23456);
    tcpTransport.request('foo', function(result) {
        test.equal('foo', result, 'loopback worked correctly');
        tcpTransport.shutdown(function() {
            server.close(test.done.bind(test));
        });
    });
};

exports.sweep = function(test) {
    test.expect(2);
    var server = net.createServer(function(con) {
        var buffer = new Buffer('');
        var messageLen = 0;
        con.on('data', function(data) {
            buffer = Buffer.concat([buffer, data]);
            if(messageLen === 0) messageLen = shared.getMessageLen([data]);
            if(buffer.length === messageLen + 4) {
                setTimeout(function() {
                    con.write(buffer);
                    con.end();
                }, 400);
            }
        });
    });
    server.listen(23457);
    var tcpTransport = new TcpTransport('localhost', 23457, { timeout: 100 });
    tcpTransport.request('foo', function(err, result) {
        test.ok(!!err, 'should receive a timeout error');
        if(result) test.ok(false, 'this should never run');
    });
    setTimeout(function() {
        test.ok(true, 'this should always run');
        tcpTransport.shutdown(function() {
            server.close(test.done.bind(test));
        });
    }, 1000);
};

exports.glitchedConnection = function(test) {
    test.expect(3);
    var con;
    var serverFunc = function(c) {
        con = c;
        var buffer = new Buffer('');
        var messageLen = 0;
        c.on('data', function(data) {
            buffer = Buffer.concat([buffer, data]);
            if(messageLen === 0) messageLen = shared.getMessageLen([data]);
            if(buffer.length === messageLen + 4) {
                setTimeout(function() {
                    if(con) {
                        con.write(buffer);
                        con.end();
                    }
                }, 400);
            }
        });
        c.on('end', function() {
            con = undefined;
        });
    };
    var server = net.createServer(serverFunc);
    server.listen(23458);
    var tcpTransport = new TcpTransport('localhost', 23458);
    tcpTransport.request({'id': 'foo'}, function(result) {
        test.equal(JSON.stringify({'id': 'foo'}), JSON.stringify(result), 'eventually received the response');
        tcpTransport.shutdown(function() {
            server.close(test.done.bind(test));
        });
    });

    // Kill the original server to simulate an error
    setTimeout(function() {
        test.ok(true, 'server was killed');
        con.destroy();
        con = undefined;
        server.close();
    }, 50);

    // Start a new server to reconnect to
    setTimeout(function() {
        test.ok(true, 'new server created to actually handle the request');
        server = net.createServer(serverFunc);
        server.listen(23458);
    }, 100);
};

exports.stopBuffering = function(test) {
    test.expect(6);
    var con, server;
    // Create a client pointed to nowhere, telling it to stop trying requests after a while
    // (but continue attempting to connect to the server)
    var tcpTransport = new TcpTransport('localhost', 23459, {
        timeout: 2*1000,
        stopBufferingAfter: 5*1000
    });
    // Early messages will be attempted and eventually time out
    tcpTransport.request({id: 'foo'}, function(result) {
        test.ok(result instanceof Error, "Couldn't connect to the (nonexistent) server");
        test.equal(result.message, 'Request Timed Out', 'time out error message received');
    });
    // Later messages will be immediately killed
    setTimeout(function() {
        tcpTransport.request({id: 'foo'}, function(result) {
            test.ok(result instanceof Error, "Still can't connect to the nonexistent server");
            test.equal(result.message, 'Connection Unavailable', 'immediately blocked by the maximum timeout time for the server');
            var serverFunc = function(c) {
                con = c;
                var buffer = new Buffer('');
                var messageLen = 0;
                c.on('data', function(data) {
                    buffer = Buffer.concat([buffer, data]);
                    if(messageLen === 0) messageLen = shared.getMessageLen([data]);
                    if(buffer.length === messageLen + 4) {
                        if(con) {
                            con.write(buffer);
                            con.end();
                        }
                    }
                });
                c.on('end', function() {
                    con = undefined;
                });
            };
            server = net.createServer(serverFunc);
            server.listen(23459);
        });
    }, 6*1000);
    // After the server is started, messages will go through as expected
    setTimeout(function() {
        tcpTransport.request({id: 'foo'}, function(result) {
            test.ok(result instanceof Object, 'got a result');
            test.equal(result.id, 'foo', 'got the expected result');
            tcpTransport.shutdown(function() {
                server.close(test.done.bind(test));
            });
        });
    }, 8*1000);
};

exports.dontStopBuffering = function(test) {
    test.expect(6);
    // This test tests a modification of the above test,
    // if its told to stop buffering after a period of time of
    // being disconnected, but then reconnects *before* that period
    // the stopBuffering code shouldn't interfere with regular requests
    var server;
    var tcpTransport = new TcpTransport('localhost', 23460, {
        timeout: 2*1000,
        stopBufferingAfter: 8*1000
    });
    tcpTransport.request({id: 'foo'}, function(result) {
        test.ok(result instanceof Error);
        test.equal(result.message, 'Request Timed Out');
    });
    setTimeout(function() {
        tcpTransport.request({id: 'foo'}, function(result) {
            test.ok(result instanceof Object);
            test.equal(result.id, 'foo');
        });
        var serverFunc = function(c) {
            var buffer = new Buffer('');
            var messageLen = 0;
            c.on('data', function(data) {
                buffer = Buffer.concat([buffer, data]);
                if(messageLen === 0) messageLen = shared.getMessageLen([data]);
                if(buffer.length === messageLen + 4) {
                    c.write(buffer);
                    c.end();
                }
            });
        };
        server = net.createServer(serverFunc);
        server.listen(23460);
    }, 6*1000);
    setTimeout(function() {
        tcpTransport.request({id: 'foo'}, function(result) {
            test.ok(result instanceof Object);
            test.equal(result.id, 'foo');
            tcpTransport.shutdown(function() {
                server.close(test.done.bind(test));
            });
        });
    }, 10*1000);
};
