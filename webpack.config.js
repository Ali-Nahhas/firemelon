export default {
    module: {
        rules: [
            {
                test: /\.worker\.js$/,
                use: { loader: 'worker-loader' },
            },
        ],
    },
    output: {
        globalObject: 'this',
    },
};
