// # The Agrosica SHA2 module
// implements the SHA-256 (SHA-2 variant) algorithm for ASCII strings.
// Based on code released into the public domain by David Ellis in January 2010
// that was originally based on the SHA-2 algorithm description on Wikipedia.
// Confirmed to function properly against *sha256sum* on the command line.

// ## The *rightrotate* function
// is a helper function to perform the right rotate bit-banging functionality
// not natively provided by Javascript. Assumes a 32-bit number.
function rightrotate(num, rotate) {
	var output = num;
	var mask = 0xFFFFFFFF;
	mask = ~(mask << rotate);
	output = ((output & mask) << (32-rotate)) + (output >>> rotate);
	return output;
}

// ## The *numToHexString* function
// is a helper function to take a 32-bit number and convert it into a hex string
// conformant to the needs of the *SHA2* function.
function numToHexString(num) {
	var mask = 0x0000000F;
	var output = "";
	for(var i = 0; i < 8; i++) {
		var partial = mask & num;
		if(partial < 10) {
			output = "" + partial + output;
		} else {
			output = String.fromCharCode("A".charCodeAt(0)+partial-10) + output;
		}
		num >>>= 4;
	}
	return output;
}

// ## The *SHA2* function
// implements the SHA-256 algorithm. I do not claim to fully understand this
// algorithm. See the [Wikipedia entry on SHA-2](http://en.wikipedia.org/wiki/SHA-2)
// for more details.
function SHA2(text) {
	var mask = 0xFF;
	// The seeds are the first 32 bits of the fractional parts of the square roots of the first 8 primes 2..19
	var h = [	0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
	
	// These seeds are the first 32 bits of the fractional parts of the cube roots of the first 64 primes 2..311
	var k = [	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
				0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
				0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
				0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
				0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
				0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
				0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
				0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
	
	var textArray = new Array();
	// This conversion of the input text into an array of bits **will** fail
	// on complex utf8 inputs, and should be re-implemented. The *Buffer*
	// object may be a good start for this.
	for(var i = 0; i < text.length; i++) {
		textArray[i] = text.charCodeAt(i) & mask;
	}
	var remainingChars = 64 - (textArray.length % 64);
	// Can't fit SHA256 sum encoding on the end
	if(remainingChars < 8) {
		remainingChars += 64;
	}
	// The standard calls for the length of the input text to be appended to the
	// end of the text bytes, with padding to make it fit in 64 byte blocks.
	// This code also needs some work as it assumes the length will not be more
	// than 2048 bytes long, if I'm understanding this correctly (wrote it a
	// while ago), while the standard provides for a massive input size (all of
	// *midChars* **and** most of the bits in the *firstChar*.
	var firstChar = 0x80;
	var midChars = 0x00;
	var lastChar = textArray.length*8;
	textArray.push(firstChar);
	remainingChars--;
	for(var i = 0; i < remainingChars - 8; i++) {
		textArray.push(midChars);
	}
	for(var i = 1; i < 8; i++) {
		textArray.push(midChars);
	}
	textArray.push(lastChar);
	// Here starts the real meat of the algorithm. Again, I refer you to the
	// Wikipedia article on this algorithm for a better understanding.
	for(var i = 0; i < textArray.length; i+=64) {
		var vals = new Array();
		for(var j = 0; j < 16; j++) {
			vals[j] = (textArray[i+(4*j)]) << 24;
			vals[j] += (textArray[i+(4*j)+1]) << 16;
			vals[j] += (textArray[i+(4*j)+2]) << 8;
			vals[j] += (textArray[i+(4*j)+3]);
		}
		for(var j = 16; j < 64; j++) {
			var temp0 = rightrotate(vals[j-15], 7) ^ rightrotate(vals[j-15], 18) ^ (vals[j-15] >>> 3);
			var temp1 = rightrotate(vals[j-2], 17) ^ rightrotate(vals[j-2], 19) ^ (vals[j-2] >>> 10);
			vals[j] = (vals[j-16] + temp0 + vals[j-7] + temp1) % Math.pow(2, 32);
		}
		var c = new Array();
		for(var j in h) {
			c[j] = h[j];
		}
		for(var j = 0; j < 64; j++) {
			var s0 = rightrotate(c[0], 2) ^ rightrotate(c[0], 13) ^ rightrotate(c[0], 22);
			var maj = (c[0] & c[1]) ^ (c[0] & c[2]) ^ (c[1] & c[2]);
			var t2 = (s0 + maj) % Math.pow(2, 32);
			var s1 = rightrotate(c[4], 6) ^ rightrotate(c[4], 11) ^ rightrotate(c[4], 25);
			var ch = (c[4] & c[5]) ^ ((~c[4]) & c[6]);
			var t1 = (c[7] + s1 + ch + k[j] + vals[j]) % Math.pow(2, 32);
			c[7] = c[6];
			c[6] = c[5];
			c[5] = c[4];
			c[4] = (c[3] + t1) % Math.pow(2, 32);
			c[3] = c[2];
			c[2] = c[1];
			c[1] = c[0];
			c[0] = (t1 + t2) % Math.pow(2, 32);
		}
		for(var j in h) {
			h[j] = (h[j] + c[j]) % Math.pow(2, 32);
		}
	}
	// Finally, the hash array, *h*, is converted into a string to be used elsewhere
	var output = "";
	for(var i in h) {
		output += numToHexString(h[i]);
	}
	return output;
}
// If this code is running in Node.js, add it to the exports
if(module && module.exports) {
	module.exports = SHA2;
}
