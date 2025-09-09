// Basic test to verify core functionality without full network setup
const { expect } = require('chai')
const path = require('path')
const fs = require('fs')

describe('Basic Functionality Tests', function () {
	it('should load oscript files', function () {
		const perpetualPath = path.join(__dirname, '../perpetual.oscript')
		const stakingPath = path.join(__dirname, '../staking.oscript')

		expect(() => fs.accessSync(perpetualPath)).to.not.throw()
		expect(() => fs.accessSync(stakingPath)).to.not.throw()

		const perpetualContent = fs.readFileSync(perpetualPath, 'utf8')
		const stakingContent = fs.readFileSync(stakingPath, 'utf8')

		expect(perpetualContent).to.include('perpetual')
		expect(stakingContent).to.include('staking')
	})

	it('should have valid package.json', function () {
		const packagePath = path.join(__dirname, '../package.json')
		expect(() => fs.accessSync(packagePath)).to.not.throw()

		const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
		expect(packageJson.name).to.be.a('string')
		expect(packageJson.version).to.be.a('string')
	})

	it('should have required dependencies', function () {
		const packagePath = path.join(__dirname, '../package.json')
		const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

		expect(packageJson.dependencies).to.have.property('express')
		expect(packageJson.dependencies).to.have.property('aa-testkit')
		expect(packageJson.dependencies).to.have.property('ocore')
	})

	it('should load configuration', function () {
		const configPath = path.join(__dirname, '../src/config.js')
		expect(() => fs.accessSync(configPath)).to.not.throw()

		const config = require('../src/config')
		expect(config).to.be.an('object')
	})

	it('should load metrics provider', function () {
		const metricsPath = path.join(__dirname, '../src/metricsProvider.js')
		expect(() => fs.accessSync(metricsPath)).to.not.throw()

		const metricsProvider = require('../src/metricsProvider')
		expect(metricsProvider).to.be.a('function')
	})

	it('should load server module', function () {
		const serverPath = path.join(__dirname, '../src/server.js')
		expect(() => fs.accessSync(serverPath)).to.not.throw()

		const server = require('../src/server')
		expect(server).to.be.a('function')
	})
})
