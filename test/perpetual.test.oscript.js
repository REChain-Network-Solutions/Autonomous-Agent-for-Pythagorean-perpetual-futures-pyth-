// uses `aa-testkit` testing framework for AA tests. Docs can be found here `https://github.com/valyakin/aa-testkit`
// `mocha` standard functions and `expect` from `chai` are available globally
const { Testkit } = require('aa-testkit')
const { Network } = Testkit()
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
})
