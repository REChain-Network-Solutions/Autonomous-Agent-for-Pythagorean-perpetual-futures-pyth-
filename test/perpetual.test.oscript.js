// uses `aa-testkit` testing framework for AA tests. Docs can be found here `https://github.com/valyakin/aa-testkit`
// `mocha` standard functions and `expect` from `chai` are available globally
// `Testkit`, `Network`, `Nodes` and `Utils` from `aa-testkit` are available globally too
const { expect } = require('chai')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const objectHash = require("ocore/object_hash.js");
const parseOjson = require('ocore/formula/parse_ojson').parse

async function getAaAddress(aa_src) {
	return objectHash.getChash160(await promisify(parseOjson)(aa_src));
}

function round(n, precision) {
	return parseFloat(n.toPrecision(precision));
}


describe('Various trades in perpetual', function () {
	this.timeout(120000)

	before(async () => {

		const staking_lib = fs.readFileSync(path.join(__dirname, '../staking-lib.oscript'), 'utf8');
		const staking_lib_address = await getAaAddress(staking_lib);

		let staking_base = fs.readFileSync(path.join(__dirname, '../staking.oscript'), 'utf8');
		staking_base = staking_base.replace(/\$lib_aa = '\w{32}'/, `$lib_aa = '${staking_lib_address}'`)
		const staking_base_address = await getAaAddress(staking_base);
		
		let perp_base = fs.readFileSync(path.join(__dirname, '../perpetual.oscript'), 'utf8');
		perp_base = perp_base.replace(/\$staking_base_aa = '\w{32}'/, `$staking_base_aa = '${staking_base_address}'`)
		const perp_base_address = await getAaAddress(perp_base);
		
		let factory = fs.readFileSync(path.join(__dirname, '../factory.oscript'), 'utf8');
		factory = factory.replace(/\$base_aa = '\w{32}'/, `$base_aa = '${perp_base_address}'`)

		this.network = await Network.create()
			.with.numberOfWitnesses(1)
			.with.asset({ ousd: {} })
			.with.asset({ REChainEXChange: {} }) // reward asset
			.with.asset({ REChainEXChange2: {} }) // 2nd reward asset
			.with.asset({ wbtc: {} }) // REChainEXChange asset

			.with.agent({ v2Pool: path.join(__dirname, '../vendor/REChainEXChange-v2-aa/pool.oscript') })

			.with.agent({ reserve_price_base: path.join(__dirname, '../REChainEXChange_reserve_price.oscript') })
			.with.agent({ price_base: path.join(__dirname, '../price.oscript') })
			.with.agent({ staking_lib: path.join(__dirname, '../staking-lib.oscript') })
			.with.agent({ staking_base })
			.with.agent({ perp_base })
			.with.agent({ factory })
			.with.wallet({ oracle: {base: 1e9} })
			.with.wallet({ alice: {base: 100000e9, ousd: 10000e9, wbtc: 1000e8} })
			.with.wallet({ bob: {base: 1000e9, ousd: 10000e9, wbtc: 10e8} })
			.with.wallet({ osw: {base: 100e9, REChainEXChange: 10000e9, REChainEXChange2: 10000e9} })
		//	.with.explorer()
			.run()
		
		console.log('--- agents\n', this.network.agent)
		console.log('--- assets\n', this.network.asset)

		this.ousd = this.network.asset.ousd
		this.wbtc = this.network.asset.wbtc
		this.REChainEXChange = this.network.asset.REChainEXChange
		this.REChainEXChange2 = this.network.asset.REChainEXChange2

		this.oracle = this.network.wallet.oracle
		this.oracleAddress = await this.oracle.getAddress()
		this.alice = this.network.wallet.alice
		this.aliceAddress = await this.alice.getAddress()
		this.bob = this.network.wallet.bob
		this.bobAddress = await this.bob.getAddress()
		this.osw = this.network.wallet.osw

		this.multiplier = 1e-8
		const { address: btc_price_aa_address, error } = await this.alice.deployAgent({
			base_aa: this.network.agent.price_base,
			params: {
				oracle: this.oracleAddress,
				feed_name: 'BTC_USD',
				multiplier: this.multiplier,
			}
		})
		expect(error).to.be.null
		this.btc_price_aa_address = btc_price_aa_address

		this.executeGetter = async (aa, getter, args = []) => {
			const { result, error } = await this.alice.executeGetter({
				aaAddress: aa,
				getter,
				args
			})
			if (error)
				console.log(error)
			expect(error).to.be.null
			return result
		}

		this.timetravel = async (shift = '1d') => {
			const { error, timestamp } = await this.network.timetravel({ shift })
			expect(error).to.be.null
		}

		this.get_price = async (asset, bWithPriceAdjustment = true) => {
			return await this.executeGetter(this.perp_aa, 'get_price', [asset, bWithPriceAdjustment])
		}

		this.get_exchange_result = async (asset, tokens, delta_r) => {
			return await this.executeGetter(this.perp_aa, 'get_exchange_result', [asset, tokens, delta_r])
		}

		this.get_auction_price = async (asset) => {
			return await this.executeGetter(this.perp_aa, 'get_auction_price', [asset])
		}

		this.get_rewards = async (user_address, perp_asset) => {
			return await this.executeGetter(this.staking_aa, 'get_rewards', [user_address, perp_asset])
		}

		this.checkCurve = async () => {
			const { vars } = await this.alice.readAAStateVars(this.perp_aa)
			const { state } = vars
			const { reserve, s0, a0, coef } = state
			let sum = a0 * s0 ** 2
			for (let var_name in vars)
				if (var_name.startsWith('asset_')) {
					const { supply, a } = vars[var_name]
					if (supply && a)
						sum += a * supply ** 2
				}
			const r = coef * Math.sqrt(sum)
			expect(r).to.be.closeTo(reserve, 20)
		}

		this.checkVotes = (vars) => {
			expect(vars.group_vps.total).to.eq(vars.state.total_normalized_vp);
			let users = [];
			let grand_total = 0;
			let all_vps = {};
			for (let v in vars) {
				if (v.startsWith('user_') && v.endsWith('_a0')) {
					const user = v.substr(5, 32);
					users.push(user);
				}
				if (v.startsWith('perp_vps_g')) {
					const group_num = v.substr(10);
					const perp_vps = vars[v];
					let total = 0;
					for (let key in perp_vps) {
						if (key !== 'total' && perp_vps[key]) {
							total += perp_vps[key];
							all_vps[key] = perp_vps[key];
						}
					}
					expect(total).to.closeTo(perp_vps.total, 1.5);
					expect(total).to.closeTo(vars.group_vps['g' + group_num] || 0, 1.5);
					grand_total += total;
				}
			}
			expect(grand_total).to.closeTo(vars.state.total_normalized_vp, 1);
		
			let total_normalized_vp = 0;
			let all_users_vps = {};
			for (let user of users) {
				const { normalized_vp } = vars['user_' + user + '_a0'];
				total_normalized_vp += normalized_vp;
				let total_votes = 0;
				const votes = vars['votes_' + user];
				for (let key in votes) {
					total_votes += votes[key];
					if (!all_users_vps[key])
						all_users_vps[key] = 0;
					all_users_vps[key] += votes[key];
				}
				expect(total_votes).to.closeTo(normalized_vp, 0.8);
			}
			expect(total_normalized_vp).to.closeTo(vars.state.total_normalized_vp, 0.9)
			expect(Object.keys(all_vps).length).to.eq(Object.keys(all_users_vps).length)
			for (let key in all_vps)
				expect(all_vps[key]).to.closeTo(all_users_vps[key], 0.8);
		}


	})

	it('Post data feed', async () => {
		const { unit, error } = await this.oracle.sendMulti({
			messages: [{
				app: 'data_feed',
				payload: {
					BTC_USD: 20000,
					GREChain_USD: 20,
				}
			}],
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { unitObj } = await this.oracle.getUnitInfo({ unit: unit })
		const dfMessage = unitObj.messages.find(m => m.app === 'data_feed')
		expect(dfMessage.payload).to.deep.equalInAnyOrder({
			BTC_USD: 20000,
			GREChain_USD: 20,
		})
	})

	it('Bob defines GREChain-WBTC pool', async () => {
		// deploy minimal vendor pool directly
		const { address, error } = await this.bob.deployAgent({
			base_aa: this.network.agent.v2Pool,
			params: { x_asset: 'base', y_asset: this.wbtc }
		})
		expect(error).to.be.null
		this.REChainEXChange_aa = address
		expect(this.REChainEXChange_aa).to.be.validAddress
		// lp asset will be created on first add
	})
	
	it('Alice adds liquidity to GREChain-WBTC pool', async () => {
		const gREChain_amount = 10000e9
		const wbtc_amount = 10e8
		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				base: [{ address: this.REChainEXChange_aa, amount: gREChain_amount + 1e4 }],
				[this.wbtc]: [{ address: this.REChainEXChange_aa, amount: wbtc_amount }],
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(JSON.parse(response.response.responseVars.event).type).to.be.equal("add")

		// fetch lp asset now
		const { vars } = await this.bob.readAAStateVars(this.REChainEXChange_aa)
		this.lp_asset = vars.lp_shares.asset
		expect(this.lp_asset).to.be.validUnit
	})

	it('Bob adds liquidity to GREChain-WBTC pool', async () => {
		const gREChain_amount = 100e9
		const wbtc_amount = 0.1e8
		const { unit, error } = await this.bob.sendMulti({
			outputs_by_asset: {
				base: [{ address: this.REChainEXChange_aa, amount: gREChain_amount + 1e4 }],
				[this.wbtc]: [{ address: this.REChainEXChange_aa, amount: wbtc_amount }],
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnit(unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(JSON.parse(response.response.responseVars.event).type).to.be.equal("add")
	})

	it('Alice defines reserve price AA', async () => {
		const { address, unit, error } = await this.alice.deployAgent({
			base_aa: this.network.agent.reserve_price_base,
			params: {
				REChainEXChange_aa: this.REChainEXChange_aa,
				x_oracle: this.oracleAddress,
				y_oracle: this.oracleAddress,
				x_feed_name: 'GREChain_USD',
				y_feed_name: 'BTC_USD',
				x_decimals: 9,
				y_decimals: 8,
			}
		})
		expect(error).to.be.null
		this.reserve_price_aa = address
		await this.network.witnessUntilStable(unit)
		const reserve_price = await this.executeGetter(this.reserve_price_aa, 'get_reserve_price');
		const { vars } = await this.bob.readAAStateVars(this.REChainEXChange_aa)
		console.log('reserve price', reserve_price, 'total', reserve_price * vars.lp_shares.issued, 'shares', vars.lp_shares.issued)
	})

	it('Bob defines a new perp', async () => {
		const { error: tf_error } = await this.network.timefreeze()
		expect(tf_error).to.be.null
		
	//	this.reserve_asset = 'base'
	//	this.reserve_asset = this.ousd
		this.reserve_asset = this.lp_asset
		this.swap_fee = 0.003
		this.arb_profit_tax = 0.9
		const { unit, error } = await this.bob.triggerAaWithData({
			toAddress: this.network.agent.factory,
			amount: 10000,
			data: {
				reserve_asset: this.reserve_asset,
				reserve_price_aa: this.reserve_price_aa,
				swap_fee: this.swap_fee,
				arb_profit_tax: this.arb_profit_tax,
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.bob, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
	//	await this.network.witnessUntilStable(response.response_unit)

		this.perp_aa = response.response.responseVars.address
		expect(this.perp_aa).to.be.validAddress

		const { vars: perp_vars } = await this.bob.readAAStateVars(this.perp_aa)
		console.log({ perp_vars })
		this.staking_aa = perp_vars.staking_aa
		this.asset0 = perp_vars.state.asset0
		expect(this.asset0).to.be.validUnit

		const { vars: staking_vars } = await this.bob.readAAStateVars(this.staking_aa)
		console.log('staking vars', staking_vars)

		this.coef = 1

		this.network_fee_on_top = this.reserve_asset === 'base' ? 1000 : 0
		this.bounce_fees = this.reserve_asset !== 'base' && { base: [{ address: this.perp_aa, amount: 1e4 }] }
		this.bounce_fee_on_top = this.reserve_asset === 'base' ? 1e4 : 0

	})


	it('Alice buys asset0', async () => {
		const amount = 50e9
		const res = await this.get_exchange_result(this.asset0, 0, amount)
		console.log('res', res)
		expect(res.arb_profit_tax).to.be.gte(0)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.reserve_asset]: [{ address: this.perp_aa, amount: amount + this.network_fee_on_top }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.asset0,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.gte(0)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.asset0,
				address: this.aliceAddress,
				amount: res.delta_s,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()
	})

	it('Alice buys more asset0', async () => {
		await this.timetravel('1d')
		const amount = 1e9
		const res = await this.get_exchange_result(this.asset0, 0, amount)
		console.log('res', res)
		expect(res.arb_profit_tax).to.be.gte(0)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.reserve_asset]: [{ address: this.perp_aa, amount: amount + this.network_fee_on_top }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.asset0,
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.eq(res.arb_profit_tax)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.asset0,
				address: this.aliceAddress,
				amount: res.delta_s,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()
	})

	it('Alice sells some asset0', async () => {
	//	await this.timetravel('1d')
		const amount = 0.1e9
		const res = await this.get_exchange_result(this.asset0, amount, 0)
		console.log('res', res)
		expect(res.arb_profit_tax).to.be.gte(0)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.asset0]: [{ address: this.perp_aa, amount: amount }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.asset0,
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.eq(res.arb_profit_tax)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.reserve_asset,
				address: this.aliceAddress,
				amount: res.payout,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()
	})

	it('Alice stakes asset0', async () => {
		const amount = Math.floor(this.state.s0/2)
		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.asset0]: [{ address: this.staking_aa, amount: amount }],
				base: [{ address: this.staking_aa, amount: 1e4 }],
			},
			messages: [{
				app: 'data',
				payload: {
					deposit: 1,
					term: 360,
					voted_group_key: 'g1',
					percentages: {a0: 100},
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars } = await this.alice.readAAStateVars(this.staking_aa)
		console.log('staking vars', vars)
		this.perp_vps_g1 = vars.perp_vps_g1

		this.alice_vp = vars['user_' + this.aliceAddress + '_a0'].normalized_vp
		expect(vars['perp_asset_balance_a0']).to.eq(amount)
		expect(vars['user_' + this.aliceAddress + '_a0'].balance).to.eq(amount)
		expect(this.alice_vp).to.equalWithPrecision(amount * 8**((response.timestamp - 1657843200)/360/24/3600), 12)

		await this.checkCurve()
		this.checkVotes(vars)
	})

	it('Alice stakes more asset0', async () => {
		const amount = Math.floor(this.state.s0/10)
		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.asset0]: [{ address: this.staking_aa, amount: amount }],
				base: [{ address: this.staking_aa, amount: 1e4 }],
			},
			messages: [{
				app: 'data',
				payload: {
					deposit: 1,
					term: 360,
					voted_group_key: 'g1',
					percentages: {a0: 100},
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars } = await this.alice.readAAStateVars(this.staking_aa)
		console.log('staking vars', vars)
		expect(vars['perp_asset_balance_a0']).to.be.closeTo(0.6 * this.state.s0, 2)
		expect(vars['user_' + this.aliceAddress + '_a0'].balance).to.be.closeTo(0.6 * this.state.s0, 2)
		this.perp_vps_g1 = vars.perp_vps_g1

		const old_vp = this.alice_vp
		this.alice_vp = vars['user_' + this.aliceAddress + '_a0'].normalized_vp
		expect(this.alice_vp - old_vp).to.equalWithPrecision(amount * 8**((response.timestamp - 1657843200)/360/24/3600), 12)

		await this.checkCurve()
		this.checkVotes(vars)
	})

	it('Alice votes for addition of BTC asset', async () => {
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_value: 1,
				name: 'add_price_aa',
				price_aa: this.btc_price_aa_address,
				value: 'yes',
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { response: response2 } = await this.network.getAaResponseToUnitOnNode(this.alice, response.response_unit)
		this.btc_asset = response2.response.responseVars.asset
		expect(this.btc_asset).to.be.validUnit

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
		console.log('staking vars', staking_vars)
		
		const { vars: perp_vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', perp_vars)

		await this.checkCurve()
		this.checkVotes(staking_vars)
	})

	it('Alice buys BTC-pegged asset in a presale', async () => {
		const amount = 1.1e9
		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.reserve_asset]: [{ address: this.perp_aa, amount: amount + this.network_fee_on_top }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.btc_asset,
					presale: 1,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()
	})

	it('Alice withdraws reserve from BTC-pegged asset in a presale', async () => {
		const amount = 0.1e9
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.perp_aa,
			amount: 10000,
			data: {
				presale: 1,
				withdraw_amount: amount,
				asset: this.btc_asset,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.reserve_asset,
				address: this.aliceAddress,
				amount,
			},
		])

		await this.checkCurve()
	})


	it('Alice claims BTC-pegged asset from the presale', async () => {
		await this.timetravel('14d')
		const initial_asset0_price = await this.get_price(this.asset0)
		const reserve_price = await this.executeGetter(this.reserve_price_aa, 'get_reserve_price');
		const new_issued_tokens = Math.floor(1e9 * reserve_price / 20000 / this.multiplier)
		console.log('issued BTC tokens', new_issued_tokens)
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.perp_aa,
			amount: 10000,
			data: {
				claim: 1,
				asset: this.btc_asset,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.btc_asset,
				address: this.aliceAddress,
				amount: new_issued_tokens,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		const final_asset0_price = await this.get_price(this.asset0)
		expect(final_asset0_price).to.equalWithPrecision(initial_asset0_price, 6)

		await this.checkCurve()
	})


	it('Alice buys more BTC', async () => {
		const amount = 1e9
		const res = await this.get_exchange_result(this.btc_asset, 0, amount)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.reserve_asset]: [{ address: this.perp_aa, amount: amount + this.network_fee_on_top }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.btc_asset,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.gte(0)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.btc_asset,
				address: this.aliceAddress,
				amount: res.delta_s,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()

		let price = await this.get_price(this.btc_asset)
		console.log({ price })
		
		await this.timetravel('36h')
		price = await this.get_price(this.btc_asset, true)
		console.log('1.5 days', { price })
		await this.checkCurve()
		
		await this.timetravel('36h')
		price = await this.get_price(this.btc_asset, true)
		console.log('3 days', { price })
		await this.checkCurve()
		
		await this.timetravel('1d')
		price = await this.get_price(this.btc_asset, true)
		console.log('4 days', { price })
		await this.checkCurve()
	})

	it('Alice buys more BTC after the price got corrected', async () => {
		const amount = 1e9
		const res = await this.get_exchange_result(this.btc_asset, 0, amount)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.reserve_asset]: [{ address: this.perp_aa, amount: amount + this.network_fee_on_top }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.btc_asset,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.gte(0)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.btc_asset,
				address: this.aliceAddress,
				amount: res.delta_s,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()

		let price = await this.get_price(this.btc_asset)
		console.log({ price })
		
	})


	it('Alice harvests staker fee rewards', async () => {
		const expected_reward = this.state.total_staker_fees
		const rewards = await this.get_rewards(this.aliceAddress, this.asset0)
		expect(rewards).to.deep.eq({ r: expected_reward })

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 1e4,
			data: {
				withdraw_rewards: 1,
				withdraw_staker_fees: 1,
				perp_asset: this.asset0,
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { response: response2 } = await this.network.getAaResponseToUnitOnNode(this.alice, response.response_unit)
		expect(response2.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response2.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.equalPayments([
			{
				asset: this.reserve_asset,
				address: this.aliceAddress,
				amount: expected_reward,
			},
		], 1)

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
		console.log('staking vars', staking_vars)
		expect(staking_vars['asset_' + this.asset0].last_emissions).to.be.undefined
		expect(staking_vars['asset_' + this.asset0].received_emissions).to.be.undefined
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].last_perp_emissions).to.deep.eq({ r: expected_reward })
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].rewards).to.deep.eq({}) // the r key was deleted
		this.alice_withdrawn_staking_fees = expected_reward
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})

	it("Alice adds 28 more pre-IPO assets to deplete the group1's capacity", async () => {
		for (let num = 2; num <= 29; num++){
			const { unit, error } = await this.alice.triggerAaWithData({
				toAddress: this.staking_aa,
				amount: 10000,
				data: {
					vote_value: 1,
					name: 'add_preipo',
					symbol: 'preIPO' + num,
					initial_auction_price: 10,
					max_tokens: 1e9,
					value: 'yes',
				}
			})
			expect(error).to.be.null
			expect(unit).to.be.validUnit

			const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		//	console.log(num, response.response.error)
			expect(response.response.error).to.be.undefined
			expect(response.bounced).to.be.false
			expect(response.response.responseVars.new_leader).to.be.eq("yes")
			expect(response.response.responseVars.committed).to.be.eq("yes")
			expect(response.response_unit).to.be.validUnit

			const { response: response2 } = await this.network.getAaResponseToUnitOnNode(this.alice, response.response_unit)
			const asset = response2.response.responseVars.asset
			expect(asset).to.be.validUnit

			const { response: response3 } = await this.network.getAaResponseToUnitOnNode(this.alice, response2.response_unit)
			expect(response3.response_unit).to.be.null
			expect(response3.response.responseVars.message).to.be.eq("initialized new perp asset")

			const { vars } = await this.alice.readAAStateVars(this.staking_aa)
			expect(vars.last_asset_num).to.be.eq(num)
			expect(vars.last_group_num).to.be.eq(1)
			expect(vars['asset_' + asset]).to.be.deep.eq({ asset_key: 'a' + num, group_key: 'g1' })
			expect(vars['perp_vps_g1']['a' + num]).to.be.eq(0)
		}

		const { vars } = await this.alice.readAAStateVars(this.staking_aa)
		expect(vars.last_asset_num).to.be.eq(29)
		expect(vars.last_group_num).to.be.eq(1)

		this.checkCurve()
		this.checkVotes(vars)
	})

	it('Alice votes for addition of pre-IPO SPACEX asset', async () => {
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_value: 1,
				name: 'add_preipo',
				symbol: 'SPACEX',
				initial_auction_price: 10,
				max_tokens: 1e9,
				value: 'yes',
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.new_leader).to.be.eq("yes")
		expect(response.response.responseVars.committed).to.be.eq("yes")

		const { response: response2 } = await this.network.getAaResponseToUnitOnNode(this.alice, response.response_unit)
		this.spacex_asset = response2.response.responseVars.asset
		expect(this.spacex_asset).to.be.validUnit

		const { response: response3 } = await this.network.getAaResponseToUnitOnNode(this.alice, response2.response_unit)
		expect(response3.response_unit).to.be.null
		expect(response3.response.responseVars.message).to.be.eq("initialized new perp asset")

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars.last_asset_num).to.be.eq(30)
		expect(staking_vars.last_group_num).to.be.eq(2)
		expect(staking_vars['asset_' + this.spacex_asset]).to.be.deep.eq({ asset_key: 'a30', group_key: 'g2' })
		expect(staking_vars['perp_vps_g2']).to.deep.eq({ a30: 0, total: 0 })
	
		const { vars: perp_vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', perp_vars)

		await this.checkCurve()
		this.checkVotes(staking_vars)
	})

	it('Alice buys SPACEX-pegged asset in a presale after the price has halved', async () => {
		await this.timetravel('3d')
		const amount = 1e9
		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.reserve_asset]: [{ address: this.perp_aa, amount: amount + this.network_fee_on_top }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.spacex_asset,
					presale: 1,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		const spacex_price = await this.get_auction_price(this.spacex_asset)
		expect(spacex_price).to.eq(5)

		await this.checkCurve()
	})

	it('Bob buys SPACEX-pegged asset in a presale after the price has halved again', async () => {
		await this.timetravel('3d')
		const amount = 1e9
		const { unit, error } = await this.bob.sendMulti({
			outputs_by_asset: {
				[this.reserve_asset]: [{ address: this.perp_aa, amount: amount + this.network_fee_on_top }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.spacex_asset,
					presale: 1,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.bob, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars } = await this.bob.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		const spacex_price = await this.get_auction_price(this.spacex_asset)
		expect(spacex_price).to.eq(2.5)

		await this.checkCurve()
	})


	it('Alice withdraws SPACEX-pegged asset from the presale', async () => {
		await this.timetravel('8d')

		const initial_asset0_price = await this.get_price(this.asset0)
		const initial_btc_price = await this.get_price(this.btc_asset)
		
		const new_issued_tokens = Math.floor(1e9 / 2.5)
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.perp_aa,
			amount: 10000,
			data: {
				claim: 1,
				asset: this.spacex_asset,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.spacex_asset,
				address: this.aliceAddress,
				amount: new_issued_tokens,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		const final_asset0_price = await this.get_price(this.asset0)
		const final_btc_price = await this.get_price(this.btc_asset)
		expect(final_asset0_price).to.equalWithPrecision(initial_asset0_price, 6)
		expect(final_btc_price).to.equalWithPrecision(initial_btc_price, 6)

		await this.checkCurve()
	})


	it('Bob withdraws SPACEX-pegged asset from the presale', async () => {
		const new_issued_tokens = Math.floor(1e9 / 2.5)
		const { unit, error } = await this.bob.triggerAaWithData({
			toAddress: this.perp_aa,
			amount: 10000,
			data: {
				claim: 1,
				asset: this.spacex_asset,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.bob, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.bob.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.spacex_asset,
				address: this.bobAddress,
				amount: new_issued_tokens,
			},
		])

		const { vars } = await this.bob.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()

		let btc_price = await this.get_price(this.btc_asset)
		let spacex_price = await this.get_price(this.spacex_asset)
		console.log({ btc_price, spacex_price })
		
		await this.timetravel('36h')
		btc_price = await this.get_price(this.btc_asset)
		spacex_price = await this.get_price(this.spacex_asset)
		console.log('1.5 days', { btc_price, spacex_price })
		await this.checkCurve()
	})


	it('Alice buys more SPACEX', async () => {
		const amount = 1e9
		const res = await this.get_exchange_result(this.spacex_asset, 0, amount)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.reserve_asset]: [{ address: this.perp_aa, amount: amount + this.network_fee_on_top }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.spacex_asset,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.gte(0)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.spacex_asset,
				address: this.aliceAddress,
				amount: res.delta_s,
			},
		])
		this.last_bought_spacex_amount = res.delta_s

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()

		let btc_price = await this.get_price(this.btc_asset)
		let spacex_price = await this.get_price(this.spacex_asset)
		console.log({ btc_price, spacex_price })
		
		await this.timetravel('36h')
		btc_price = await this.get_price(this.btc_asset)
		spacex_price = await this.get_price(this.spacex_asset)
		console.log('1.5 days', { btc_price, spacex_price })
		await this.checkCurve()

	})

	it('Alice sells BTC', async () => {
		const amount = 1e7 // half
		const res = await this.get_exchange_result(this.btc_asset, amount, 0)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.btc_asset]: [{ address: this.perp_aa, amount: amount }],
				base: [{address: this.perp_aa, amount: 1e4}]
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.btc_asset,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.gte(0)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.reserve_asset,
				address: this.aliceAddress,
				amount: res.payout,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()

		let btc_price = await this.get_price(this.btc_asset)
		let spacex_price = await this.get_price(this.spacex_asset)
		console.log({ btc_price, spacex_price })
		
		await this.timetravel('36h')
		btc_price = await this.get_price(this.btc_asset)
		spacex_price = await this.get_price(this.spacex_asset)
		console.log('1.5 days', { btc_price, spacex_price })
		await this.checkCurve()

	})


	it('Alice sells more asset0', async () => {
	//	await this.timetravel('1d')
		const amount = 0.1e9
		const res = await this.get_exchange_result(this.asset0, amount, 0)
		console.log('res', res)
		expect(res.arb_profit_tax).to.be.gte(0)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.asset0]: [{ address: this.perp_aa, amount: amount }],
				...this.bounce_fees
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.asset0,
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.eq(res.arb_profit_tax)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.reserve_asset,
				address: this.aliceAddress,
				amount: res.payout,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()
	})

	it('Alice sells some SPACEX', async () => {
		const amount = Math.floor(this.last_bought_spacex_amount / 2)
		const res = await this.get_exchange_result(this.spacex_asset, amount, 0)

		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.spacex_asset]: [{ address: this.perp_aa, amount: amount }],
				base: [{address: this.perp_aa, amount: 1e4}]
			},
			messages: [{
				app: 'data',
				payload: {
					asset: this.spacex_asset,
				}
			}]
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.arb_profit_tax).to.be.gte(0)

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.deep.equalInAnyOrder([
			{
				asset: this.reserve_asset,
				address: this.aliceAddress,
				amount: res.payout,
			},
		])

		const { vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', vars)
		this.state = vars.state

		await this.checkCurve()

		let btc_price = await this.get_price(this.btc_asset)
		let spacex_price = await this.get_price(this.spacex_asset)
		console.log({ btc_price, spacex_price })
	})

	it('Alice votes for whitelisting of REChainEXChange token as reward asset', async () => {
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_whitelist: 1,
				reward_asset: this.REChainEXChange,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("whitelisted")

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['reward_assets_'+this.REChainEXChange]).to.eq('e1')
		expect(staking_vars['emissions']).to.deep.eq({e1: 0})
		
		this.checkVotes(staking_vars)
	})

	it('Alice votes for whitelisting of REChainEXChange2 token as reward asset', async () => {
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_whitelist: 1,
				reward_asset: this.REChainEXChange2,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("whitelisted")

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['reward_assets_'+this.REChainEXChange2]).to.eq('e2')
		expect(staking_vars['emissions']).to.deep.eq({ e1: 0, e2: 0 })
		
		this.checkVotes(staking_vars)
	})

	it('Receive reward asset emissions in REChainEXChange', async () => {
		const amount = 1e9
		const { unit, error } = await this.osw.sendMulti({
			outputs_by_asset: {
				[this.REChainEXChange]: [{ address: this.staking_aa, amount: amount }],
				base: [{address: this.staking_aa, amount: 1e4}]
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.osw, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("accepted emissions")
	
		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['emissions']).to.deep.eq({ e1: amount, e2: 0 })
		this.checkVotes(staking_vars)
	})

	it('Receive reward asset emissions in REChainEXChange2', async () => {
		const amount = 2e9
		const { unit, error } = await this.osw.sendMulti({
			outputs_by_asset: {
				[this.REChainEXChange2]: [{ address: this.staking_aa, amount: amount }],
				base: [{address: this.staking_aa, amount: 1e4}]
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.osw, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("accepted emissions")
	
		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['emissions']).to.deep.eq({ e1: 1e9, e2: amount })
		this.checkVotes(staking_vars)
	})

	it('Alice moves a part of her VP to BTC and SPACEX assets', async () => {
		const vp = this.alice_vp
		console.log({vp})
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_shares: 1,
				group_key1: 'g1',
				group_key2: 'g2',
				changes: { a0: -0.4 * vp - 0.2 * vp, a1: 0.4 * vp, a30: 0.2 * vp },
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['votes_' + this.aliceAddress]).to.deepCloseTo({ a0: 0.4 * vp, a1: 0.4 * vp, a30: 0.2 * vp }, 0.001)
		let perp_vps_g1 = { a0: 0.4 * vp, a1: 0.4 * vp, total: 0.8 * vp }
		for (let i = 2; i <= 29; i++)
			perp_vps_g1['a' + i] = 0
		expect(staking_vars['perp_vps_g1']).to.deepCloseTo(perp_vps_g1, 0.001)
		expect(staking_vars['perp_vps_g2']).to.deepCloseTo({ a30: 0.2 * vp, total: 0.2 * vp }, 0.001)
		expect(staking_vars['group_vps']).to.deepCloseTo({ g1: 0.8 * vp, g2: 0.2 * vp, total: vp }, 0.001)
		this.checkVotes(staking_vars)
	})

	it('Alice stakes BTC', async () => {
		const amount = 0.5e7
		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.btc_asset]: [{ address: this.staking_aa, amount: amount }],
				base: [{ address: this.staking_aa, amount: 1e4 }],
			},
			messages: [{
				app: 'data',
				payload: {
					deposit: 1,
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['perp_asset_balance_a1']).to.eq(amount)
		expect(staking_vars['user_' + this.aliceAddress + '_a1'].balance).to.eq(amount)
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})

	it('Bob stakes SPACEX', async () => {
		const amount = Math.floor(1e9/2.5)
		const { unit, error } = await this.bob.sendMulti({
			outputs_by_asset: {
				[this.spacex_asset]: [{ address: this.staking_aa, amount: amount }],
				base: [{ address: this.staking_aa, amount: 1e4 }],
			},
			messages: [{
				app: 'data',
				payload: {
					deposit: 1,
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.bob, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['perp_asset_balance_a30']).to.eq(amount)
		expect(staking_vars['user_' + this.bobAddress + '_a30'].balance).to.eq(amount)
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})


	it('Receive reward asset emissions again', async () => {
		const amount = 2e9
		const { unit, error } = await this.osw.sendMulti({
			outputs_by_asset: {
				[this.REChainEXChange]: [{ address: this.staking_aa, amount: amount }],
				base: [{address: this.staking_aa, amount: 1e4}]
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.osw, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("accepted emissions")
	
		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['emissions']).to.deep.eq({ e1: 3e9, e2: 2e9 })
		this.checkVotes(staking_vars)
	})

	it('Alice harvests REChainEXChange rewards from staking BTC', async () => {
		const expected_reward = 2e9 * 0.4
		const rewards = await this.get_rewards(this.aliceAddress, this.btc_asset)
		expect(rewards).to.deepCloseTo({ e1: expected_reward, e2: 0 }, 0.0001) // e2=0 because there were no e2 emissions after Alice staked BTC

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 1e4,
			data: {
				withdraw_rewards: 1,
				perp_asset: this.btc_asset,
				reward_asset: this.REChainEXChange,
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.equalPayments([
			{
				asset: this.REChainEXChange,
				address: this.aliceAddress,
				amount: expected_reward,
			},
		], 1)

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars['asset_' + this.btc_asset].last_emissions).to.deep.eq({ e1: 3e9, e2: 2e9 })
		expect(staking_vars['asset_' + this.btc_asset].received_emissions).to.deepCloseTo({ e1: 3e9 * 0.4, e2: 2e9 * 0.4 }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a1'].last_perp_emissions).to.deepCloseTo({ e1: 3e9 * 0.4, e2: 2e9 * 0.4 }, 0.0001)
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})

	it('Bob harvests REChainEXChange rewards from staking SPACEX', async () => {
		const expected_reward = 2e9 * 0.2
		const rewards = await this.get_rewards(this.bobAddress, this.spacex_asset)
		expect(rewards).to.deepCloseTo({ e1: expected_reward, e2: 0 }, 0.0001) // e2=0 because there were no e2 emissions after Bob staked SPACEX

		const { unit, error } = await this.bob.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 1e4,
			data: {
				withdraw_rewards: 1,
				perp_asset: this.spacex_asset,
				reward_asset: this.REChainEXChange,
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.bob, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.bob.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.equalPayments([
			{
				asset: this.REChainEXChange,
				address: this.bobAddress,
				amount: expected_reward,
			},
		], 1)

		const { vars: staking_vars } = await this.bob.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars['asset_' + this.spacex_asset].last_emissions).to.deep.eq({ e1: 3e9, e2: 2e9 })
		expect(staking_vars['asset_' + this.spacex_asset].received_emissions).to.deepCloseTo({ e1: 3e9 * 0.2, e2: 2e9 * 0.2 }, 1)
		expect(staking_vars['user_' + this.bobAddress + '_a30'].last_perp_emissions).to.deepCloseTo({ e1: 3e9 * 0.2, e2: 2e9 * 0.2 }, 0.001)
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})


	it('Receive reward asset emissions #3', async () => {
		const amount = 1e9
		const { unit, error } = await this.osw.sendMulti({
			outputs_by_asset: {
				[this.REChainEXChange]: [{ address: this.staking_aa, amount: amount }],
				base: [{address: this.staking_aa, amount: 1e4}]
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.osw, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("accepted emissions")
	
		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['emissions']).to.deep.eq({ e1: 4e9, e2: 2e9 })
		this.checkVotes(staking_vars)
	})

	it('Alice stakes more BTC and REChainEXChange rewards get updated', async () => {
		const amount = 0.5e7
		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.btc_asset]: [{ address: this.staking_aa, amount: amount }],
				base: [{ address: this.staking_aa, amount: 1e4 }],
			},
			messages: [{
				app: 'data',
				payload: {
					deposit: 1,
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars['asset_' + this.btc_asset].last_emissions).to.deep.eq({ e1: 4e9, e2: 2e9 })
		expect(staking_vars['asset_' + this.btc_asset].received_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 2e9 * 0.4 }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a1'].last_perp_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 2e9 * 0.4 }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a1'].rewards).to.deep.eq({ e1: 1e9 * 0.4, e2: 0 })
		expect(staking_vars['user_' + this.aliceAddress + '_a1'].balance).to.eq(1e7)
		expect(staking_vars['perp_asset_balance_a1']).to.eq(1e7)
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})


	it('Alice harvests REChainEXChange rewards from staking asset0', async () => {
		const expected_reward = 4e9 * 0.4
		const rewards = await this.get_rewards(this.aliceAddress, this.asset0)
		expect(rewards).to.deepCloseTo({ e1: expected_reward, e2: 2e9 * 0.4, r: this.state.total_staker_fees - this.alice_withdrawn_staking_fees }, 0.0001) // e2>0 because Alice already staked a0 when e2 emissions were received

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 1e4,
			data: {
				withdraw_rewards: 1,
				perp_asset: this.asset0,
				reward_asset: this.REChainEXChange,
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.equalPayments([
			{
				asset: this.REChainEXChange,
				address: this.aliceAddress,
				amount: expected_reward,
			},
		], 1)

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars['asset_' + this.asset0].last_emissions).to.deep.eq({ e1: 4e9, e2: 2e9 })
		expect(staking_vars['asset_' + this.asset0].received_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 2e9 * 0.4 }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].last_perp_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 2e9 * 0.4, r: this.state.total_staker_fees }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].rewards).to.deepCloseTo({ e2: 2e9 * 0.4, r: this.state.total_staker_fees - this.alice_withdrawn_staking_fees }, 0.00001)
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})

	it('Alice withdraws BTC and harvests REChainEXChange rewards from staking BTC', async () => {
		const expected_reward = 1e9 * 0.4
		const rewards = await this.get_rewards(this.aliceAddress, this.btc_asset)
		expect(rewards).to.deep.eq({ e1: expected_reward, e2: 0 }) // e2=0 because there were no e2 emissions after Alice staked BTC

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 1e4,
			data: {
				withdraw: 1,
				perp_asset: this.btc_asset,
				reward_asset: this.REChainEXChange,
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.equalPayments([
			{
				asset: this.REChainEXChange,
				address: this.aliceAddress,
				amount: expected_reward,
			},
			{
				asset: this.btc_asset,
				address: this.aliceAddress,
				amount: 1e7,
			},
		], 1)

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars['asset_' + this.btc_asset].last_emissions).to.deep.eq({ e1: 4e9, e2: 2e9 })
		expect(staking_vars['asset_' + this.btc_asset].received_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 2e9 * 0.4 }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a1']).to.be.undefined
		expect(staking_vars['perp_asset_balance_a1']).to.eq(0)
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})

	it('Alice stakes asset0 again', async () => {
		const old_vp = this.alice_vp
		const old_votes = {
			a0: 0.4 * this.alice_vp,
			a1: 0.4 * this.alice_vp,
			a30: 0.2 * this.alice_vp,
		}
		const amount = Math.floor(this.state.s0/10)
		const { unit, error } = await this.alice.sendMulti({
			outputs_by_asset: {
				[this.asset0]: [{ address: this.staking_aa, amount: amount }],
				base: [{ address: this.staking_aa, amount: 1e4 }],
			},
			messages: [{
				app: 'data',
				payload: {
					deposit: 1,
					term: 360,
					voted_group_key: 'g1',
					percentages: { a0: 40, a1: 60 },
				}
			}],
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		this.perp_vps_g1 = staking_vars.perp_vps_g1

		this.alice_vp = staking_vars['user_' + this.aliceAddress + '_a0'].normalized_vp
		const staked_balance = staking_vars['user_' + this.aliceAddress + '_a0'].balance
		expect(this.alice_vp).to.closeTo(staked_balance * 8**((response.timestamp - 1657843200)/360/24/3600), 100)
		
		const added_vp = this.alice_vp - old_vp
		const new_votes = {
			a0: old_votes.a0 + 0.4 * added_vp,
			a1: old_votes.a1 + 0.6 * added_vp,
			a30: old_votes.a30,
		}
		expect(staking_vars['votes_' + this.aliceAddress]).to.deepCloseTo(new_votes, 0.002)
		let perp_vps_g1 = { a0: new_votes.a0, a1: new_votes.a1, total: new_votes.a0 + new_votes.a1 }
		for (let i = 2; i <= 29; i++)
			perp_vps_g1['a' + i] = 0
		expect(staking_vars['perp_vps_g1']).to.deepCloseTo(perp_vps_g1, 0.01)
		expect(staking_vars['perp_vps_g2']).to.deepCloseTo({ a30: old_votes.a30, total: old_votes.a30 }, 0.001)
		expect(staking_vars['group_vps']).to.deepCloseTo({ g1: new_votes.a0 + new_votes.a1, g2: old_votes.a30, total: this.alice_vp }, 0.01)
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].rewards).to.deepCloseTo({ e1: 0, e2: 2e9 * 0.4, r: this.state.total_staker_fees - this.alice_withdrawn_staking_fees }, 0.0001)
	//	expect(staking_vars['perp_asset_balance_a0']).to.closeTo(0.7 * this.state.s0, 3)
	//	expect(staking_vars['user_' + this.aliceAddress + '_a0'].balance).to.closeTo(0.7 * this.state.s0, 3)

		await this.checkCurve()
		this.checkVotes(staking_vars)
	})

	it('Receive reward asset emissions in REChainEXChange2 again', async () => {
		const amount = 3e9
		const { unit, error } = await this.osw.sendMulti({
			outputs_by_asset: {
				[this.REChainEXChange2]: [{ address: this.staking_aa, amount: amount }],
				base: [{address: this.staking_aa, amount: 1e4}]
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.osw, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("accepted emissions")
	
		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['emissions']).to.deep.eq({ e1: 4e9, e2: 5e9 })
		this.checkVotes(staking_vars)
	})

	it('Alice votes for blacklisting of REChainEXChange2 token as reward asset', async () => {
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_blacklist: 1,
				reward_asset: this.REChainEXChange2,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("blacklisted")

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['reward_assets_'+this.REChainEXChange2]).to.eq('e2')
		expect(staking_vars['emissions']).to.deep.eq({ e1: 4e9 })
		
		this.checkVotes(staking_vars)
	})

	it('Alice removes the blacklisted REChainEXChange2 token as reward asset', async () => {
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				remove: 1,
				reward_asset: this.REChainEXChange2,
			//	perp_asset: this.asset0,
				perp_asset: this.btc_asset,
			//	perp_asset: this.spacex_asset,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['reward_assets_' + this.REChainEXChange2]).to.eq('e2')
		expect(staking_vars['emissions']).to.deep.eq({ e1: 4e9 })
		
	//	expect(staking_vars['asset_' + this.asset0].last_emissions).to.deep.eq({ e1: 4e9 })
	//	expect(staking_vars['asset_' + this.asset0].received_emissions).to.deep.eq({ e1: 4e9 * 0.4 })
	//	expect(staking_vars['user_' + this.aliceAddress + '_a0'].last_perp_emissions).to.deep.eq({ e1: 4e9 * 0.4 })
	//	expect(staking_vars['user_' + this.aliceAddress + '_a0'].rewards).to.deep.eq({ e1: 0, e2: 2e9 * 0.4 })

		expect(staking_vars['asset_' + this.btc_asset].last_emissions).to.deep.eq({ e1: 4e9 })
		expect(staking_vars['asset_' + this.btc_asset].received_emissions).to.deep.eq({ e1: 4e9 * 0.4 })
		expect(staking_vars['user_' + this.aliceAddress + '_a1']).to.be.undefined

	//	expect(staking_vars['asset_' + this.spacex_asset].last_emissions).to.deep.eq({ e1: 3e9 })
	//	expect(staking_vars['asset_' + this.spacex_asset].received_emissions).to.deep.eq({ e1: 3e9 * 0.2 })
	//	expect(staking_vars['user_' + this.aliceAddress + '_a30']).to.be.undefined

		this.checkVotes(staking_vars)
	})

	it('Try to receive reward asset emissions in the blacklisted REChainEXChange2', async () => {
		const amount = 7e9
		const { unit, error } = await this.osw.sendMulti({
			outputs_by_asset: {
				[this.REChainEXChange2]: [{ address: this.staking_aa, amount: amount }],
				base: [{address: this.staking_aa, amount: 1e4}]
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.osw, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
		expect(response.response.error).to.be.eq("neither case is true in messages")
		expect(response.bounced).to.be.true
		expect(response.response_unit).to.be.validUnit
	})

	it('Alice harvests the blacklisted REChainEXChange2 rewards from staking asset0', async () => {
		const expected_reward = 2e9 * 0.4
		const rewards = await this.get_rewards(this.aliceAddress, this.asset0)
		expect(rewards).to.deepCloseTo({ e1: 0, e2: expected_reward, r: this.state.total_staker_fees - this.alice_withdrawn_staking_fees }, 0.0001) // e2>0 because Alice already staked a0 when e2 emissions were received

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 1e4,
			data: {
				withdraw_rewards: 1,
				perp_asset: this.asset0,
				reward_asset: this.REChainEXChange2,
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.equalPayments([
			{
				asset: this.REChainEXChange2,
				address: this.aliceAddress,
				amount: expected_reward,
			},
		], 1)

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars['asset_' + this.asset0].last_emissions).to.deep.eq({ e1: 4e9, e2: 2e9 })
		expect(staking_vars['asset_' + this.asset0].received_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 2e9 * 0.4 }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].last_perp_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 2e9 * 0.4, r: this.state.total_staker_fees }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].rewards).to.deep.eq({ e1: 0, r: this.state.total_staker_fees - this.alice_withdrawn_staking_fees })
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})
	
	it('Alice votes for re-whitelisting of REChainEXChange2 token as reward asset', async () => {
		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_whitelist: 1,
				reward_asset: this.REChainEXChange2,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("re-whitelisted")

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['reward_assets_' + this.REChainEXChange2]).to.eq('e2')
		expect(staking_vars['emissions']).to.deep.eq({ e1: 4e9, e2: 0 })
		
		this.checkVotes(staking_vars)
	})

	it('Receive reward asset emissions in REChainEXChange2 again', async () => {
		const amount = 0.7e9
		const { unit, error } = await this.osw.sendMulti({
			outputs_by_asset: {
				[this.REChainEXChange2]: [{ address: this.staking_aa, amount: amount }],
				base: [{address: this.staking_aa, amount: 1e4}]
			},
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.osw, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.null

		expect(response.response.responseVars.message).to.be.eq("accepted emissions")
	
		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking_vars', staking_vars)
		expect(staking_vars['emissions']).to.deep.eq({ e1: 4e9, e2: amount })
		this.checkVotes(staking_vars)
	})

	it('Alice harvests the re-whitelisted REChainEXChange2 rewards from staking asset0', async () => {
		const expected_reward = 0.7e9 * 0.4
		const rewards = await this.get_rewards(this.aliceAddress, this.asset0)
		expect(rewards).to.deepCloseTo({ e1: 0, e2: expected_reward, r: this.state.total_staker_fees - this.alice_withdrawn_staking_fees }, 0.0001) // e2>0 because Alice already staked a0 when e2 emissions were received

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 1e4,
			data: {
				withdraw_rewards: 1,
				perp_asset: this.asset0,
				reward_asset: this.REChainEXChange2,
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.equalPayments([
			{
				asset: this.REChainEXChange2,
				address: this.aliceAddress,
				amount: expected_reward,
			},
		], 1)

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars['asset_' + this.asset0].last_emissions).to.deep.eq({ e1: 4e9, e2: 0.7e9 })
		expect(staking_vars['asset_' + this.asset0].received_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 0.7e9 * 0.4 }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].last_perp_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 0.7e9 * 0.4, r: this.state.total_staker_fees }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].rewards).to.deep.eq({ e1: 0, r: this.state.total_staker_fees - this.alice_withdrawn_staking_fees })
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})

	it('Alice votes for setting of price AA for SPACEX asset after it was listed', async () => {
		{
			const { unit, error } = await this.oracle.sendMulti({
				messages: [{
					app: 'data_feed',
					payload: {
						SPACEX_USD: 1000,
					}
				}],
			})
			expect(error).to.be.null
			expect(unit).to.be.validUnit
		}

		const { address: spacex_price_aa_address, error: deploy_error } = await this.alice.deployAgent({
			base_aa: this.network.agent.price_base,
			params: {
				oracle: this.oracleAddress,
				feed_name: 'SPACEX_USD',
				multiplier: this.multiplier,
			}
		})
		expect(deploy_error).to.be.null
		this.spacex_price_aa_address = spacex_price_aa_address

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_value: 1,
				name: 'change_price_aa',
				asset: this.spacex_asset,
				value: spacex_price_aa_address,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		console.log(response.response.error)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit
		expect(response.response.responseVars.new_leader).to.be.eq(spacex_price_aa_address)
		expect(response.response.responseVars.committed).to.be.eq(spacex_price_aa_address)

		const { response: response2 } = await this.network.getAaResponseToUnitOnNode(this.alice, response.response_unit)
		expect(response2.response.responseVars).to.be.undefined
		expect(response2.response_unit).to.be.null

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
	//	console.log('staking vars', staking_vars)
		expect(staking_vars['change_price_aa' + this.spacex_asset]).to.be.eq(spacex_price_aa_address)
	
		const { vars: perp_vars } = await this.alice.readAAStateVars(this.perp_aa)
		console.log('perp vars', perp_vars)
		expect(perp_vars['asset_' + this.spacex_asset].price_aa).eq(spacex_price_aa_address)

		await this.checkCurve()
		this.checkVotes(staking_vars)
	})
	
	it('Alice votes for setting of price AA for BTC asset and fails', async () => {

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 10000,
			data: {
				vote_value: 1,
				name: 'change_price_aa',
				asset: this.btc_asset,
				value: this.spacex_price_aa_address,
			}
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
		expect(response.response.error).to.be.eq(`one of secondary AAs bounced with error: ${this.perp_aa}: only preipo can set a price AA`)
		expect(response.bounced).to.be.true
	})
	

	it('Alice harvests staker fee rewards again', async () => {
		const expected_reward = this.state.total_staker_fees - this.alice_withdrawn_staking_fees
		const rewards = await this.get_rewards(this.aliceAddress, this.asset0)
		expect(rewards).to.deep.eq({ e1: 0, e2: 0, r: expected_reward })

		const { unit, error } = await this.alice.triggerAaWithData({
			toAddress: this.staking_aa,
			amount: 1e4,
			data: {
				withdraw_rewards: 1,
				withdraw_staker_fees: 1,
				perp_asset: this.asset0,
			},
			spend_unconfirmed: 'all',
		})
		expect(error).to.be.null
		expect(unit).to.be.validUnit

		const { response } = await this.network.getAaResponseToUnitOnNode(this.alice, unit)
	//	console.log('logs', JSON.stringify(response.logs, null, 2))
		console.log(response.response.error)
	//	await this.network.witnessUntilStable(response.response_unit)
		expect(response.response.error).to.be.undefined
		expect(response.bounced).to.be.false
		expect(response.response_unit).to.be.validUnit

		const { response: response2 } = await this.network.getAaResponseToUnitOnNode(this.alice, response.response_unit)
		expect(response2.response_unit).to.be.validUnit

		const { unitObj } = await this.alice.getUnitInfo({ unit: response2.response_unit })
		console.log(Utils.getExternalPayments(unitObj))
		expect(Utils.getExternalPayments(unitObj)).to.equalPayments([
			{
				asset: this.reserve_asset,
				address: this.aliceAddress,
				amount: expected_reward,
			},
		], 1)

		const { vars: staking_vars } = await this.alice.readAAStateVars(this.staking_aa)
		expect(staking_vars['asset_' + this.asset0].last_emissions).to.deep.eq({ e1: 4e9, e2: 0.7e9 })
		expect(staking_vars['asset_' + this.asset0].received_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 0.7e9 * 0.4 }, 0.0001)
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].last_perp_emissions).to.deepCloseTo({ e1: 4e9 * 0.4, e2: 0.7e9 * 0.4, r: this.state.total_staker_fees })
		expect(staking_vars['user_' + this.aliceAddress + '_a0'].rewards).to.deep.eq({ e1: 0, e2: 0 }) // the r key was deleted
		this.alice_withdrawn_staking_fees += expected_reward
		this.perp_vps_g1 = staking_vars.perp_vps_g1
		this.checkVotes(staking_vars)
	})
	
	after(async () => {
		// uncomment this line to pause test execution to get time for OREChain DAG explorer inspection
	//	await Utils.sleep(3600 * 1000)
		await this.network.stop()
	})
})
