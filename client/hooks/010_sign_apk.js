var spawn = require('child_process').spawn,
    cp    = spawn('cmd.exe', ['/c', 'c:\\dev\\whoSmarter_sign.bat']);

cp.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
});

cp.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
});

cp.on('exit', function (code) {
    console.log('child process exited with code ' + code);
});