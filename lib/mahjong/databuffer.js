var logger = require('../log/xgateway.js').logger("info");
var DataBuffer = function(opt_data) {
	if(opt_data) {
		if(opt_data instanceof Buffer) {
			this.dataBuffer = opt_data;
		} else {
			this.dataBuffer = undefined;
		}
		if(!(this.dataBuffer instanceof Buffer)) {
			throw 'dataBuffer type error';
		}
	} else {
		this.dataBuffer = Buffer.alloc(DataBuffer.PACKET_DATA_OFFSET);
	}
	this.readPos = DataBuffer.PACKET_DATA_OFFSET;
};

module.exports = DataBuffer;

/* dataBuffer packet flag value 'QS' = 21329,uint16 little endian */
DataBuffer.PACKET_FLAG_VALUE  = 21329;
/* dataBuffer head variable length */
DataBuffer.PACKET_VAR_LENGTH  = 2;
/* dataBuffer packet flag start offset */
DataBuffer.PACKET_FLAG_OFFSET = 0;
/* dataBuffer packet size start offset */
DataBuffer.PACKET_SIZE_OFFSET = 2;
/* dataBuffer packet cmd  start offset */
DataBuffer.PACKET_CMD_OFFSET  = 4;
/* dataBuffer packet data start offset */
DataBuffer.PACKET_DATA_OFFSET = 6;
/* dataBuffer packet data size length */
DataBuffer.PACKET_DATA_LENGTH = 4;

/**
 * Read lenth of data from dataBuffer
 * @param {!number} length
 * @param {!number} opt_readPos option read position
 * @return {!Uint8Array}
 */
DataBuffer.prototype.readBuff = function(length, opt_readPos) {
	let pos = opt_readPos || this.readPos;
	if(length > this.dataBuffer.length || length + pos > this.dataBuffer.length)
		return null;
	let retBuff = Buffer.from(this.dataBuffer.buffer, pos, length);
	this.readPos = this.readPos + length;
	return Uint8Array.from(retBuff);
};

/**
 * Read data from dataBuffer, length from the dataBuffer
 * @return {!Uint8Array} 
 */
DataBuffer.prototype.readBinary = function() {
	let length = this.dataBuffer.readUInt32LE(this.readPos);
	this.readPos += DataBuffer.PACKET_DATA_LENGTH;
	if(length > this.dataBuffer.length || length + this.readPos > this.dataBuffer.length)
		return null;
	//let retBuff = Buffer.from(this.dataBuffer.buffer, this.readPos, length);
	let retBuff = new Uint8Array(length);
	for(let i = 0; i < length; i++) {
		retBuff[i] = this.dataBuffer.readUInt8(this.readPos + i);
	}
	this.readPos = this.readPos + length;
	return retBuff;
};

/**
 * Read data from dataBuffer, length from the dataBuffer, length -= 1;
 * @return {!Uint8Array} 
 */
DataBuffer.prototype.read = function() {
	let length = this.dataBuffer.readUInt32LE(this.readPos);
	//logger.info('read length =', length);
	this.readPos += DataBuffer.PACKET_DATA_LENGTH;
	if(length > this.dataBuffer.length || length + this.readPos > this.dataBuffer.length)
		return null;
	//logger.error('readPos =', this.readPos);
	//let retBuff = Buffer.from(this.dataBuffer.buffer, this.readPos, length - 1);
	//logger.error('retBuff =', retBuff);
	let retBuff = new Uint8Array(length - 1);
	for(let i = 0; i < length - 1; i++) {
		retBuff[i] = this.dataBuffer.readUInt8(this.readPos + i);
	}
	this.readPos = this.readPos + length;
	return retBuff;
};

DataBuffer.prototype.flag = function() {
	return this.dataBuffer.readUInt16LE(DataBuffer.PACKET_FLAG_OFFSET);
};

DataBuffer.prototype.len = function() {
	return this.dataBuffer.readUInt16LE(DataBuffer.PACKET_SIZE_OFFSET);
};

DataBuffer.prototype.cmd = function() {
	return this.dataBuffer.readUInt16LE(DataBuffer.PACKET_CMD_OFFSET);
};

/**
 * Write data to this.dataBuffer
 */
DataBuffer.prototype.writeBinary = function(writeData, opt_writePos, opt_length) {
	if(!(writeData instanceof ArrayBuffer)){
		throw "writeData type erro";
	}
	let newDataBuff = Buffer.alloc(this.dataBuffer.length + writeData.byteLength + 
		DataBuffer.PACKET_DATA_LENGTH);
	this.dataBuffer.copy(newDataBuff);
	newDataBuff.writeUInt32LE(writeData.byteLength, this.dataBuffer.length);
	Buffer.from(writeData).copy(newDataBuff, this.dataBuffer.length + 
		DataBuffer.PACKET_DATA_LENGTH);
	this.dataBuffer = newDataBuff;
};

/**
 * Write data to this.dataBuffer length + 1
 */
DataBuffer.prototype.write = function(writeData, opt_writePos, opt_length) {
	if(!(writeData instanceof ArrayBuffer)){
		throw "writeData type erro";
	}
	let newDataBuff = Buffer.alloc(this.dataBuffer.length + writeData.byteLength);
	this.dataBuffer.copy(newDataBuff);
	Buffer.from(writeData).copy(newDataBuff, this.dataBuffer.length);
	this.dataBuffer = newDataBuff;
};

/**
 * Write flag, length of total packet payload, and cmd
 * @param {!number} cmd
 */
DataBuffer.prototype.writeEnd = function(cmd) {
	this.dataBuffer.writeUInt16LE(21329, DataBuffer.PACKET_FLAG_OFFSET);//flag 'QS'
	this.dataBuffer.writeUInt16LE(this.dataBuffer.length - DataBuffer.PACKET_DATA_OFFSET,
		DataBuffer.PACKET_SIZE_OFFSET);
	this.dataBuffer.writeUInt16LE(cmd, DataBuffer.PACKET_CMD_OFFSET);
};


