const { MercadoPagoConfig, Preference } = require("mercadopago");
const planos = require("../../config/planos");

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({
          erro: "Método não permitido",
        }),
      };
    }

    const { plano } = JSON.parse(event.body);

    if (!planos[plano]) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          erro: "Plano inválido.",
        }),
      };
    }

    const dadosPlano = planos[plano];

    const preference = new Preference(client);

    const resposta = await preference.create({
      body: {
        items: [
          {
            title: dadosPlano.nome,
            quantity: 1,
            unit_price: Number(dadosPlano.valor),
            currency_id: "BRL",
          },
        ],

        back_urls: {
          success: "https://eroticpad.netlify.app/sucesso.html",
          failure: "https://eroticpad.netlify.app/falha.html",
          pending: "https://eroticpad.netlify.app/pendente.html",
        },

        auto_return: "approved",
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        sucesso: true,
        init_point: resposta.init_point,
      }),
    };
  } catch (erro) {
    console.error(erro);

    return {
      statusCode: 500,
      body: JSON.stringify({
        erro: erro.message,
      }),
    };
  }
};