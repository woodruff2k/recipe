import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const demo = await prisma.user.upsert({
    where: { email: "demo@recipe.dev" },
    update: {},
    create: { email: "demo@recipe.dev", name: "Demo Chef", passwordHash },
  });

  await prisma.recipe.create({
    data: {
      title: "기본 토마토 파스타",
      description: "간단하고 빠른 평일 저녁 메뉴.",
      ingredients: JSON.stringify([
        "스파게티 200g",
        "토마토 소스 1컵",
        "마늘 2쪽",
        "올리브유",
      ]),
      steps: JSON.stringify([
        "물을 끓여 면을 삶는다.",
        "팬에 마늘을 볶고 토마토 소스를 넣는다.",
        "삶은 면을 소스에 버무린다.",
      ]),
      authorId: demo.id,
    },
  });

  console.log("Seed complete: demo@recipe.dev / password123");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
