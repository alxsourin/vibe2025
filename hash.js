const bcrypt = require('bcrypt');
bcrypt.hash('password', 10).then(hash => console.log(hash));