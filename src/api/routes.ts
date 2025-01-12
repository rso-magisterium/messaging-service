import { Router } from "express";
import passport from "passport";

import message from "./message";
import contacts from "./contacts";

const router = Router();

router.use("/message", passport.authenticate("jwt", { session: false }), message);
router.use("/contacts", passport.authenticate("jwt", { session: false }), contacts);

export default router;
