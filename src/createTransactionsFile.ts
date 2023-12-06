import bz2 from "unbzip2-stream"
import { ReadStream, createReadStream, createWriteStream } from 'fs'
import * as dotenv from "dotenv"
import { WikipediaStream } from "./wikipediaStream"
import { getPageNodeFromPage, getQueryStringsFromPageNode } from "./pageUtils"
dotenv.config()

const WIKIPEDIA_ZIP_FILE_NAME = 'enwiki-20230820-pages-articles-multistream.xml.bz2'
const TRANSACTIONS_FILE_NAME = 'transactions.csv'
const TRANSACTIONS_FILE_DELIMITER = String.fromCharCode(31)
const BUFFER_CAPACITY = 10000

const main = async () => {
    let stream: ReadStream | undefined
    let transactionsWriteStream = createWriteStream(TRANSACTIONS_FILE_NAME)
    transactionsWriteStream.cork()

    let bufferSize: number = 0

    const onProgramEnd = async (err?: Error) => {
        console.log('ending program')
        if (err != null) console.error(err)
        console.log(`WRITING OUT ${bufferSize} TRANSACTIONS`)
        transactionsWriteStream.close()
        if (stream != null) stream.destroy()
    }

    process.on('SIGINT', onProgramEnd)
    process.on('SIGTERM', onProgramEnd)

    const wikipediaStream: WikipediaStream = new WikipediaStream()
    wikipediaStream.on("page", (page) => {
        const pageNode = getPageNodeFromPage(page)
        const queries = getQueryStringsFromPageNode(pageNode)
        const queriesString = queries.join(TRANSACTIONS_FILE_DELIMITER) + '\n'

        transactionsWriteStream.write(queriesString)
        bufferSize += 1

        if (bufferSize === BUFFER_CAPACITY) {
            console.log(`WRITING OUT ${bufferSize} TRANSACTIONS`)
            process.nextTick(() => transactionsWriteStream.uncork())
            bufferSize = 0
            process.nextTick(() => transactionsWriteStream.cork())
        }
    })

    stream = createReadStream(WIKIPEDIA_ZIP_FILE_NAME)
    stream.pipe(bz2()).pipe(wikipediaStream)
        .on('close', onProgramEnd)
        .on('error', onProgramEnd)
}

main().catch(console.error)
