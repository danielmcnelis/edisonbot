
//DECK FUNCTIONS

//MODULE IMPORTS
const fs = require('fs')
const { Builder, By, until } = require('selenium-webdriver')
const firefox = require('selenium-webdriver/firefox')
const { Op } = require('sequelize')
const { exec } = require('child_process')

//DATABASE IMPORTS
const { Card, Info, Status } = require('../db')

//FUNCTION IMPORTS
const { clearStatus, convertArrayToObject } = require('./utility.js')

//STATIC IMPORTS
const { dandy } = require('../static/emojis.json')
const { 
    accum, airbellum, alius, alo, archer, arma, artemis, bfadd, boomboxen, bribe, bushi, caius, cat, celfon, chariot, codarus,
    coelacanth, consonance, cstrike, dad, dandylion, ddwl, debris, detonation, diva, drastic, duplication, emmersblade, exodia, 
    faultroll, fert, firedog, fishborg, fortress, fulhelm, garden, gateway, gearframe, ggadget, gobzomb, gotss, gottoms, gozen,
    gravirose, grepher, gspark, icarus, jdrag, kalut, kmdrago, kristya, laquari, life, lion, lonefire, mali, mezuki, miracle,
    mobius, monk, moray, motr, necrovalley, quickdraw, raiza, recharge, redmd, rejuv, rekindling, remoten, rgadget, rivalry, 
    rota, ryko, salvo, sirocco, solidarity, sorc, spy, ssunited, swapfrog, tethys, thestalos, tradein, treeborn, tuningware, 
    turtle, valhalla, vayu, vrocket, whirlwind, wmc, wyvern, ygadget, zanji
} = require('../static/cards.json')

//SAVE YDK
const saveYDK = async (player, url, tournamentName = 'other') => {
    let deck_arr = []
    const options = new firefox.Options()
    options.addArguments("-headless")
    const driver = await new Builder().forBrowser('firefox').setFirefoxOptions(options).build()
    
    const get_deck = `
        deck_arr = ["#created by ...", "#main"]

        for (let i = 0; i < deck_filled_arr.length; i++) {
            if (~~deck_filled_arr[i].data("serial_number") > 0) {
                deck_arr.push(deck_filled_arr[i].data("serial_number"))
            }
        }

        deck_arr.push("#extra")
        for (i = 0; i < extra_filled_arr.length; i++) {
            if (~~extra_filled_arr[i].data("serial_number") > 0) {
                deck_arr.push(extra_filled_arr[i].data("serial_number"))   
            }
        }

        deck_arr.push("!side")
        for (i = 0; i < side_filled_arr.length; i++) {
            if (~~side_filled_arr[i].data("serial_number") > 0) {
                deck_arr.push(side_filled_arr[i].data("serial_number"))
            }
        }

        deck_arr.push("")
        return deck_arr
    `

    try {      
        console.log(`Loading ${player.tag}'s deck at ${url}...`)
        await driver.get(url)
        console.log('driver got Url')
        await driver.wait(until.elementLocated(By.id('deck_card1')), 60000)
        console.log('driver found deck_card1')
        deck_arr = await driver.executeScript(get_deck)
        console.log('driver executed script')
    } catch (err) {
        console.log(err)
        try {
            await driver.quit()
            console.log('driver quit')
            exec('killall firefox')
            exec('killall /usr/lib/firefox/firefox')
            await clearStatus('firefox')
        } catch (err) {
            console.log(err)
        }
    } finally {
        try {
            await driver.quit()
            console.log('driver quit')
            exec('killall firefox')
            exec('killall /usr/lib/firefox/firefox')
            await clearStatus('firefox')
        } catch (err) {
            console.log(err)
        }
    }
      
    if (!deck_arr.length) return false
    const file = deck_arr.join('\n')
    const cards_arr = deck_arr.filter(el => el.charAt(0) !== '#' && el.charAt(0) !== '!' && el !== '').sort()
    const cards_obj = convertArrayToObject(cards_arr)        
    const card_ids = [...await Card.findAll({ where: { tcg_date: { [Op.lte]: '2010-04-24' } }})].map(c => c.konamiCode)
    const forbidden_card_ids = [...await Status.findAll({ where: { mar10: 'forbidden' }, include: Card })].map(s => s.card.konamiCode)
    const limited_card_ids = [...await Status.findAll({ where: { mar10: 'limited' }, include: Card })].map(s => s.card.konamiCode)
    const semi_limited_card_ids = [...await Status.findAll({ where: { mar10: 'semi-limited' }, include: Card })].map(s => s.card.konamiCode)

    const illegalCards = []
    const forbiddenCards = []
    const limitedCards = []
    const semiLimitedCards = []
    const unrecognizedCards = []

    const keys = Object.keys(cards_obj)
    for (let i = 0; i < keys.length; i++) {
        let konamiCode = keys[i]
        while (konamiCode.length < 8) konamiCode = '0' + konamiCode 
        if (!card_ids.includes(konamiCode)) {
            const card = await Card.findOne({ where: { konamiCode: konamiCode } })
            if (card) {
                illegalCards.push(card.name)
            } else {
                unrecognizedCards.push(konamiCode)
            }
        } else if (forbidden_card_ids.includes(konamiCode)) {
            const card = await Card.findOne({ where: { konamiCode: konamiCode } })
            if (card) forbiddenCards.push(card.name)
        } else if (limited_card_ids.includes(konamiCode) && cards_obj[konamiCode] > 1) {
            const card = await Card.findOne({ where: { konamiCode: konamiCode } })
            if (card) limitedCards.push(card.name)
        } else if (semi_limited_card_ids.includes(konamiCode) && cards_obj[konamiCode] > 2) {
            const card = await Card.findOne({ where: { konamiCode: konamiCode } })
            if (card) semiLimitedCards.push(card.name)
        }
    }

    const tag = player.tag.replace(/[^\ws]/gi, "_").replace(/ /g,'')
    fs.writeFile(`./decks/${tournamentName}/${tag}.ydk`, file, (err) => {
        if(err) {
            return console.log(err)
        } else {
            console.log(`${player.tag}'s deck was saved!`)
        }
    })
    
    illegalCards.sort()
    forbiddenCards.sort()
    limitedCards.sort()
    semiLimitedCards.sort()
    unrecognizedCards.sort()

    const issues = {
        illegalCards,
        forbiddenCards,
        limitedCards,
        semiLimitedCards,
        unrecognizedCards
    }

    return issues
}

//CHECK DECK LIST
const checkDeckList = async (member, player, tournamentName) => {  
    const filter = m => m.author.id === member.user.id
    const message = await member.user.send({ content: `Please provide a duelingbook.com/deck link for the Edison Format ${dandy} deck you would like to check.`}).catch((err) => console.log(err))
    if (!message || !message.channel) return false
    return await message.channel.awaitMessages({
        filter,
        max: 1,
        time: 30000
    }).then(async collected => {
        const url = collected.first().content
        if (url.includes("www.duelingbook.com/deck")) {		
            member.send({ content: 'Thanks. Please wait while I download the .YDK file. This can take up to 30 seconds.'})
            const issues = await saveYDK(player, url, tournamentName)
            return issues
        } else {
            message.author.send({ content: "Sorry, I only accept duelingbook.com/deck links."})    
            return false  
        }
    }).catch(err => {
        console.log(err)
        member.send({ content: `Sorry, time's up. Go back to the server and try again.`})
        return false
    })
}

//GET DECK TYPE
const getDeckType = async (player, tournamentName = 'other') => {
    const file = `./decks/${tournamentName}/${player.tag.replace(/[^\ws]/gi, "_").replace(/ /g,'')}.ydk`
    const raw = fs.readFileSync(file, 'utf8')
    if (!raw) return
    const main = raw.split('#extra')[0]
    if (!main) return
    const arr = main.split('\n').filter(el => el.charAt(0) !== '#' && el.charAt(0) !== '!' && el !== '').sort()
    const ydk = convertArrayToObject(arr)

    const deckType = (ydk[kalut] >= 2 && ydk[whirlwind] >= 2 && ydk[icarus] >= 2) ? 'blackwing' :
            (ydk[accum] >= 2 && ydk[cstrike] >= 2 && ydk[detonation] >= 2) ? 'chain burn' :
            (ydk[diva] >= 2 && ydk[mali] >= 2 && ydk[miracle] >= 2) ? 'diva hero' :
            (ydk[alius] >= 2 && ydk[gspark] >= 2) ? 'hero beatdown' :
            (ydk[redmd] >= 2 && ydk[wyvern] && ydk[kmdrago] && !ydk[consonance] && !ydk[rejuv]) ? 'dragon beatdown' :
            (ydk[redmd] >= 2 && ydk[consonance] >= 2 && ydk[tradein] >= 2 && !ydk[exodia]) ? 'dragon turbo' :
            (ydk[boomboxen] >= 2 && ydk[celfon] >= 2 && ydk[remoten] >= 2) ? 'morphtronic' :
            (ydk[consonance] >= 2 && ydk[rejuv] >= 2 && ydk[exodia]) ? 'exodia ftk' :
            (ydk[artemis] >= 2 && ydk[bribe] >= 2 && ydk[drastic] >= 2) ? 'counter fairy' :
            (ydk[kristya] >= 2 && ydk[ddwl] >= 2 && ydk[ryko] >= 2) ? 'fairy control' :
            (ydk[kristya] >= 2 && ydk[tethys] >= 2 && ydk[valhalla] >= 2) ? 'fairy turbo' :
            (ydk[kristya] >= 3 && !!ydk[tethys] && ydk[rivalry] && ydk[gozen]) ? 'fairy stun' :
            (ydk[coelacanth] >= 2 && ydk[fishborg] >= 2 && ydk[moray] >= 2) ? 'fish otk' :
            (ydk[firedog] >= 2 && ydk[spy] >= 2 && ydk[rekindling] >= 2) ? 'flamvell' :
            (ydk[swapfrog] >= 2 && ydk[caius] >= 2 && (ydk[raiza] || ydk[mobius] || ydk[thestalos]) && !ydk[diva]) ? 'frog monarch' :
            (ydk[swapfrog] >= 2 && ydk[caius] >= 2 && ydk[diva] >= 2 && ydk[archer]) ? 'diva frog' :
            (ydk[ggadget] >= 2 && ydk[rgadget] >= 2 && ydk[ygadget] >= 2 && !ydk[gearframe]) ? 'gadget' :
            (ydk[ggadget] >= 2 && ydk[rgadget] >= 2 && ydk[ygadget] >= 2 && ydk[gearframe] >= 2) ? 'machina gadget' :
            (ydk[gearframe] >= 2 && ydk[fortress] >= 2 && !ydk[ggadget]) ? 'machina' :
            (ydk[laquari] >= 2 && ydk[chariot] >= 2) ? 'gladiator beast' :
            (ydk[jdrag] >= 2 && ydk[recharge] >= 2) ? 'lightsworn' :
            (ydk[lonefire] >= 2 && ydk[dandylion] >= 2 && ydk[quickdraw] && ydk[debris] && !ydk[jdrag] && !ydk[gobzomb] && !ydk[rekindling] && !ydk[duplication]) ? 'quickdraw plant' :
            (ydk[vrocket] >= 2 && ydk[dandylion] >= 2 && ydk[quickdraw]) ? 'volcanic quickdraw' :
            (ydk[dandylion] >= 2  && ydk[quickdraw] && ydk[firedog] >= 2 && ydk[rekindling] >= 2) ? 'flamvell quickdraw' :
            (ydk[quickdraw] >= 2 && ydk[tuningware] >= 2 && ydk[duplication] >= 2) ? 'quickdraw machine' :
            (ydk[quickdraw] >= 2 && ydk[gobzomb] && ydk[mezuki]) ? 'quickdraw zombie' :
            (ydk[gobzomb] >= 2 && ydk[turtle] && ydk[mezuki] && ydk[life] && !ydk[quickdraw]) ? 'quickdraw zombie' :
            (ydk[gotss] >= 2 && ydk[zanji] >= 2 && ydk[gateway] >= 2 && ydk[ssunited] >= 2) ? 'six samurai' :
            (ydk[cat] && ydk[monk] && ydk[airbellum] >= 2 && ydk[spy] >= 2) ? 'synchro cat' :
            (ydk[sorc] && ydk[dad] && ydk[recharge] >= 2 && !ydk[jdrag]) ? 'chaos lightsworn' :
            (ydk[caius] >= 2 && ydk[treeborn] && ydk[recharge] >= 2 && !ydk[jdrag]) ? 'lightsworn monarch' :
            (ydk[vayu] >= 2 && ydk[sirocco] >= 2 && ydk[arma] && ydk[grepher] && ydk[bfadd]) ? 'vayu turbo' :
            (ydk[vrocket] >= 2 && ydk[garden] >= 2 && !ydk[caius] && !ydk[quickdraw]) ? 'volcanic garden' : 
            (ydk[vrocket] >= 2 && ydk[caius] >= 2 && !ydk[garden] && !ydk[quickdraw]) ? 'volcanic monarch' : 
            (ydk[emmersblade] >= 2 && ydk[faultroll] >= 2 && ydk[fulhelm] >= 2 && ydk[gottoms] >= 2) ? 'x-saber' : 
            (ydk[necrovalley] >= 2 && ydk[spy] >= 2 && ydk[wmc] >= 2) ? 'gravekeeper burn' : 
            (ydk[salvo] >= 2 && ydk[dad]) ? 'salvo dad' : 
            (ydk[lonefire] >= 2 && (ydk[lion] >= 2 || ydk[gravirose] >= 2) && (ydk[fert] >= 2 || ydk[motr] >= 2) && !ydk[quickdraw]) ? 'plant' : 
            (ydk[codarus] >= 2 && ydk[alo] >= 2) ? 'codarus' : 
            (ydk[bushi] >= 2 && ydk[rota] && ydk[solidarity] >= 2) ? 'bushi' : 
            'other' 

    return deckType
}

module.exports = {
    checkDeckList,
    getDeckType,
    saveYDK
}