import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import * as recipeController from "../controllers/recipe.controller";

const router = Router();

router.get("/", recipeController.list);
router.get("/mine", requireAuth, recipeController.listMine); // "/:id"보다 먼저
router.get("/:id", recipeController.getOne);
router.post("/", requireAuth, recipeController.create);
router.put("/:id", requireAuth, recipeController.update);
router.delete("/:id", requireAuth, recipeController.remove);

export default router;
