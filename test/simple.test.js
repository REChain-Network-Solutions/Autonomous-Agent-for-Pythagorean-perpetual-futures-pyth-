// Simple test to verify aa-testkit setup
const { expect } = require('chai')

describe('Simple Test', function () {
	it('should have Network available', function () {
		expect(typeof Network).to.equal('function')
	})

	it('should have Utils available', function () {
		expect(typeof Utils).to.equal('object')
	})

	it('should have Testkit available', function () {
		expect(typeof Testkit).to.equal('function')
	})
})
