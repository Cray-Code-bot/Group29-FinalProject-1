import express from 'express';
import * as housesData from '../data/houses.js';
import * as commentsData from '../data/comments.js';
import * as reviewsData from '../data/reviews.js';
import xss from 'xss';
import validation from '../helpers.js';
import upload from "../utils/multer.js";
import cloudinary from "../utils/cloudinary.js"
import { getRounds } from 'bcrypt';

const router = express.Router();


router.get('/', async (req, res) => {
    try {
        const housesList = await housesData.getAll();
        //the handlnars
        res.status(200).render("houses/list", { housesList, successMessage: req.query.successMessage  });
    } catch (e) {
        res.status(400).render("houses/error", { error: e });
    }
});

router.get('/list', async (req, res) => {
  try {
    const housesList = await housesData.getAll();
    console.log("housesList", housesList);
    res.render('houses/list', { housesList: housesList });
  } catch (e) {
    console.error(e);
    res.status(500).render("houses/error", { message: "An error occurred while fetching the houses list.", error: e });
  }
});

router.get("/add", async (req, res) => {
  if (!req.session.user) {
    return res.status(400).render("houses/error", { message: "You need to login"});
  }
  try {
    res.render("houses/add");
  } catch (e) {
    res.status(400).render("houses/error", { error: e });
  }
});

function validateHouseInfo(houseInfo) {
  const { type, category, city, state, gender, rent,description } = houseInfo;

  if (!type || !category || !city || !state || !gender || !rent || !description) {
    return { valid: false, message: "Please enter all the fields." };
  }

  if(type.trim().length == 0 || category.trim().length == 0 || city.trim().length == 0 || state.trim().length == 0) {
    return { valid: false, message: "Please do not only enter space." };
  }


  if (typeof type !== 'string' || typeof category !== 'string' || typeof city !== 'string' || typeof state !== 'string') {
    return { valid: false, message: "Invalid data type." };
  }

  return { valid: true };
}

router.post('/post',upload.array("images",10), async (req, res) => {

  if (!req.session.user) {
    return res.status(400).render("houses/error", { message: "You need to login"});
  }

  let emailAddress=xss(req.session.user.emailAddress);

  let imageUrls=[];

  let imagePublicIds=[];

  try{
    let imageFiles=req.files;

    if(imageFiles.length==0){
        return res.status(400).render("houses/error",{message:"No images attached!"});
    }

   for(const file of imageFiles){
     const result=await cloudinary.uploader.upload(file.path);
     imageUrls.push(result.secure_url);
     imagePublicIds.push(result.public_id);
   }

  }
  catch(err){
    res.status(400).render("houses/error",{message:err});
  }

  let roomType=xss(req.body.roomType);
  let roomCategory=xss(req.body.roomCategory);
  let gender=xss(req.body.gender);
  let city=xss(req.body.city);
  let state=xss(req.body.state);
  let rent=xss(req.body.rent);
  let description=xss(req.body.description); 

  try {

  roomType=roomType.trim().toLowerCase();
  roomCategory=roomCategory.trim().toLowerCase();
  gender=gender.trim().toLowerCase();
  city=city.trim().toLowerCase();

    if(!roomType || !roomCategory || !gender || !city || !state || !rent || !description){
      throw "Enter all the fields";
    }
    
    if(roomType.trim().length==0 || roomCategory.trim().length==0 || gender.trim().length==0 || city.trim().length==0 || 
          state.trim().length==0 || rent.trim().length==0 || description.trim().length==0){

        throw "The entered field values should not be empty or contain white spaces";
    }

    if(!roomType=="1bhk" || !roomType=="2bhk" || !roomType=="3bhk"){
      throw "The room type needs to be 1BHK,2BHK,3BHK";
    }
    
    if(!roomCategory=="private" || !roomCategory=="shared"){
      throw "The room category needs to be either Private or Shared";
    }

    if(!gender=="male" || !gender=="female" || !gender=="any"){
      throw "The gender needs to be either Male,Female or Any";
    }

    let rentCheck=parseInt(rent);

    if(typeof rentCheck!="number"){
      throw "Enter numerical values for the rent field";
    }

    let statesList=['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];

    if(!statesList.includes(state)){
      throw "Do not enter the state out of the states list";
    }

  } catch (error) {
    res.status(400).render("houses/error",{message:error});
  }
  
  let accommodationInfo={
    roomType:roomType,
    roomCategory:roomCategory,
    gender:gender,
    city:city,
    state:state,
    rent:rent,
    description:description,
    imageUrls:imageUrls,
    imagePublicIds:imagePublicIds
  }


  try {
    const newhouse = await housesData.create(accommodationInfo,emailAddress);
    console.log("newhouse", newhouse);
    res.redirect('/houses/' + newhouse._id);
  } catch (e) {
    console.error('Error during house creation:', e);
    res.status(400).render("houses/error", { message: "not created", error: e });
  }
});

router
  .route('/:id')
  .get(async (req, res) => {
    try {
      req.params.id = validation.checkId(req.params.id, 'Id URL Param');
      const house = await housesData.getById(req.params.id);
      const reviewsList = await reviewsData.getReviewsByHouseId(req.params.id);
      return res.status(200).res.render('houseDetails', { house, reviewsList });
    } catch (e) {
      res.status(404).json(e);
    }
  })

.post(async (req, res) => {
  try {
    req.params.id = validation.checkId(req.params.id, 'Id URL Param');
    if (req.params.id.trim() == "") throw 'Comment cannot be empty';
  } catch(e) {
    res.status(404).render('error', {title: 'error', message: e})
  }

  try {
    const newComment = await commentsData.createComment(req.session.user, req.params.id, req.body.commentInput);
    if (newComment != true) throw 'new comment cannot be addded'
    const house = await housesData.getById(req.params.id);
    return res.status(200).render("houseDetails", {title: 'Post Details', house: house});
  } catch (e) {
    res.status(400).render('error', {title: 'error', message: e});
  }
});

router.post('/:id/delete', async (req, res) => {
  if (!req.session.user) {
    return res.status(400).render("houses/error", { message: "You need to login"});
  }
  try {
    const houseId = req.params.id;
    const house = await housesData.getById(houseId);

    if (req.session.user.emailAddress !== house.user) {
      return res.status(400).render("houses/error", { message: "You are not the owner of this house"});
    }
    
    console.log('Deleting house with id:', houseId);
    await housesData.remove(houseId);
    res.status(200).render('houses/message', { message: 'House deleted successfully' });
  } catch (e) {
    console.error('Error during house deletion:', e);
    res.status(400).render('houses/error', { message: 'House not deleted', error: e });
  }
});

router.get('/:id/edit', async (req, res) => {
  if (!req.session.user) {
    return res.status(400).render("houses/error", { message: "You need to login"});
  }
  try {
    const house = await housesData.getById(req.params.id);
    res.render('houses/edit', { house });
  } catch (e) {
    res.status(404).render('houses/error', { message: 'House not found', error: e });
  }
});

router.post('/:id/edit', async (req, res) => {
  try {
    const houseId = req.params.id;
    const house = await housesData.getById(houseId);

    if (req.session.user.emailAddress !== house.user) {
      return res.status(400).render("houses/error", { message: "You are not the owner of this house"});
    }
    
    let houseInfo = {
      type: xss(req.body.type),
      category: xss(req.body.category),
      city: xss(req.body.city),
      state: xss(req.body.state),
      zip: xss(req.body.zip),
      rent: parseFloat(xss(req.body.rent)), 
      description: xss(req.body.description),
    };

    if (!req.session.user) {
      return res.status(400).render("houses/error", { message: "You need to login"});
    }

    const validationResult = validateHouseInfo(houseInfo);
    if (!validationResult.valid) {
      return res.status(400).render("houses/error", { message: validationResult.message });
    }

    const updatedHouse = await housesData.update(req.params.id, houseInfo);
    res.redirect('/houses');
  } catch (e) {
    console.error('Error during house update:', e);
    res.status(500).render('houses/error', { message: `Update failed: ${e.message}`, error: e });
  }
});


router.post('/houses', async (req, res) => {
  if (!req.session.user) {
    return res.status(400).render("houses/error", { message: "You need to login"});
  }
  try {
    const newHouse = await housesData.create(req.body);
    res.status(201).json(newHouse);
  } catch (e) {
    res.status(500).json({ error: e });
  }
});


export default router;
