module.exports = async function(context, req) {
  try {
    const { query: q, Client } = require("faunadb");

    const client = new Client({
      secret: process.env.DB_SECRET,
    });
    const credentials = await client.query(
      q.Let(
        {
          user: q.Get(q.Match(q.Index("users_by_email"), req.body.email)),
        },
        {
          status: "success",
          user: q.Select(["data"], q.Var("user")),
          secret: q.Select(
            ["secret"],
            q.Login(q.Select(["ref"], q.Var("user")), {
              password: req.body.password,
              ttl: q.TimeAdd(q.Now(), 1, "day"),
            }),
          ),
        },
      ),
    );
    context.res = {
      status: 200,
      body: credentials,
    };
  } catch (error) {
    context.res = {
      status: 500,
      body: error.message,
    };
  }
};
