import { blockQuote, bold, ChatInputCommandInteraction, EmbedBuilder } from "discord.js"
import { BOT_COLOR } from "../lib"
import { errorOccurredWhileTrading, getCoinData, getCoinDataAsName, getUserCoinData, removeUserCoin, userCoinIo } from "../utils/coin"
import { getCurrentDate, getCurrentTime } from "../utils/default"
import { addUserPoint, getUserData } from "../utils/userData"

const youSelledCoin = (name: string, amount: number, price: number, point: number, now: Date) => (
    new EmbedBuilder()
        .setColor(BOT_COLOR)
        .setDescription(`:white_check_mark: **성공적으로 거래되었습니다!**`)
        .addFields([
            { name: '코인 이름', value: blockQuote(bold(name)), inline: true },
            { name: '코인 가격', value: blockQuote(bold(price.toString())), inline: true }
        ])
        .addFields([
            { name: '거래 개수', value: blockQuote(bold(amount.toString())), inline: true },
            { name: '총 수익', value: blockQuote(`${price * amount}`), inline: true },
            { name: '현재 포인트', value: blockQuote(point.toString()), inline: true }
        ])
        .setFooter({ text: `거래 시각: ${getCurrentDate(now)} ${getCurrentTime(now)}` })
)

export default async function coinbuy(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply()

    const args = interaction.options
    const coinName = args.getString('이름')!
    const amount = args.getInteger('수량')!

    const userData = await getUserData(interaction.user.id)
    const userCoinData = (await getUserCoinData(interaction.user.id)).find(coin => coin.name === coinName)!
    const coinData = (await getCoinDataAsName(coinName))!
    const point = userData.point

    try {
        if (userCoinData.amount <= amount) {
            await removeUserCoin(interaction.user.id, coinData.id, userCoinData.amount)
            await addUserPoint(interaction.user.id, coinData.price * userCoinData.amount)
            userCoinIo.emit('update', {
                amount: 0,
                point: point + coinData.price * userCoinData.amount,
                coinId: coinData.id,
            })
            return await interaction.editReply({ embeds: [youSelledCoin(coinData.name, userCoinData.amount, coinData.price, point, new Date())] })
        } else if (userCoinData.amount > amount) {
            await removeUserCoin(interaction.user.id, coinData.id, amount)
            await addUserPoint(interaction.user.id, coinData.price * amount)
        }
        userCoinIo.emit('update', {
            amount: userCoinData.amount - amount,
            point: point + coinData.price * amount,
            coinId: coinData.id,
        })
        return await interaction.editReply({ embeds: [youSelledCoin(coinData.name, amount, coinData.price, point, new Date())] })
    } catch {
        return await interaction.editReply({ embeds: [errorOccurredWhileTrading] })
    }
}