module.exports = async function (context, req) {
  try {
    const { query: q, Client } = require("faunadb");

    const client = new Client({
      secret: process.env.DB_SECRET,
    });
    const { firstName, lastName, email, password, maxLevels } = req.body;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Invalid email");
    }

    if (isNaN(Number(maxLevels))) {
      throw new Error("maxLevels: number expected, non number provided");
    }

    const levels = Array(maxLevels)
      .fill(0)
      .map((_, index) => index + 1);

    const credentials = await client.query(
      q.Let(
        {
          user: q.Create(q.Collection("Users"), {
            data: {
              firstName,
              lastName,
              email,
              maxLevels,
            },
            credentials: { password },
          }),
          user_ref: q.Select(["ref"], q.Var("user")),
          levels: q.Map(
            levels,
            q.Lambda(
              "level",
              q.Create(q.Collection("Levels"), {
                data: {
                  id: q.Multiply(q.Var("level"), 100),
                  cumulative: {
                    course_count: 0,
                    total_units: 0,
                    total_grade_point: 0,
                    grade_point_average: 0,
                  },
                  user_ref: q.Var("user_ref"),
                },
              })
            )
          ),
          semesters: q.Map(
            q.Var("levels"),
            q.Lambda(
              "level",
              q.Do([
                q.Create(q.Collection("Semesters"), {
                  data: {
                    id: 0,
                    cumulative: {
                      course_count: 0,
                      total_units: 0,
                      total_grade_point: 0,
                      grade_point_average: 0,
                    },
                    level: q.Select(["ref"], q.Var("level")),
                    user_ref: q.Var("user_ref"),
                  },
                }),
                q.Create(q.Collection("Semesters"), {
                  data: {
                    id: 1,
                    cumulative: {
                      course_count: 0,
                      total_units: 0,
                      total_grade_point: 0,
                      grade_point_average: 0,
                    },
                    level: q.Select(["ref"], q.Var("level")),
                    user_ref: q.Var("user_ref"),
                  },
                }),
              ])
            )
          ),
          preferences: q.Create(q.Collection("Preferences"), {
            data: {
              showCgpa: true,
              grade_system: 5,
              user_ref: q.Var("user_ref"),
            },
          }),
        },
        {
          credentials: {
            status: "success",
            user: q.Var("user"),
            secret: q.Select(
              ["secret"],
              q.Login(q.Select(["ref"], q.Var("user")), {
                password: req.body.password,
                ttl: q.TimeAdd(q.Now(), 1, "day"),
              })
            ),
          },
        }
      )
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
