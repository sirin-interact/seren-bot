import { blockQuote, bold, ChatInputCommandInteraction, EmbedBuilder } from "discord.js"
import { BOT_COLOR } from "../lib"
import { addUserCoin, errorOccurredWhileTrading, getCoinData, getCoinDataAsName, getUserCoinData, userCoinIo } from "../utils/coin"
import { getCurrentDate, getCurrentTime } from "../utils/default"
import { getUserData, removeUserPoint } from "../utils/userData"

const notEnoughPoint = (point: number, needPoint: number) => (
    new EmbedBuilder()
        .setColor(BOT_COLOR)
        .setDescription(`:x: **포인트가 부족합니다.**`)
        .addFields([
            { name: '보유 포인트', value: `${point}`, inline: true },
            { name: '필요 포인트', value: `${needPoint}`, inline: true },
            { name: '차이', value: `${needPoint - point}`, inline: true },
        ])
)

const youBoughtCoin = (name: string, amount: number, price: number, point: number, now: Date) => (
    new EmbedBuilder()
        .setColor(BOT_COLOR)
        .setDescription(`:white_check_mark: **성공적으로 거래되었습니다!**`)
        .addFields([
            { name: '코인 이름', value: blockQuote(bold(name)), inline: true },
            { name: '코인 가격', value: blockQuote(bold(price.toString())), inline: true }
        ])
        .addFields([
            { name: '거래 개수', value: blockQuote(bold(amount.toString())), inline: true },
            { name: '총 가격', value: blockQuote(`${price * amount}`), inline: true },
            { name: '현재 포인트', value: blockQuote(point.toString()), inline: true }
        ])
        .setFooter({ text: `거래 시각: ${getCurrentDate(now)} ${getCurrentTime(now)}` })
)

export default async function coinbuy(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply()

    const args = interaction.options
    const coinName = args.getString('이름')!
    const amount = args.getInteger('수량')!

    const coinData = (await getCoinDataAsName(coinName))!
    const userCoinData = (await getUserCoinData(interaction.user.id)).find(coin => coin.name === coinName)
    const coinPrice = coinData.price
    const point = (await getUserData(interaction.user.id)).point

    if (point < coinPrice * amount) {
        return await interaction.editReply({ embeds: [notEnoughPoint(point, coinPrice * amount)] })
    }

    try {
        await removeUserPoint(interaction.user.id, coinPrice * amount)
        await addUserCoin(interaction.user.id, coinData.id, amount, new Date())
        userCoinIo.emit('update', {
            amount: userCoinData ? userCoinData.amount + amount : amount,
            point: point - coinPrice * amount
        })
        await interaction.editReply({ embeds: [youBoughtCoin(coinData.name, amount, coinPrice, point - coinPrice * amount, new Date())] })
    } catch {
        await interaction.editReply({ embeds: [errorOccurredWhileTrading] })
    }
}
