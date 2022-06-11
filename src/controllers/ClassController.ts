import db from "../database/connection";
import { Request, Response } from 'express';
import convertHourToMinutes from '../utils/converterHour';

interface ScheduleItem {
  week_day: number;
  from: string;
  to: string;
}

export default class ClassController {
  async index(req: Request, res: Response){
    const filter = req.query;

    const subject = filter.subject as string;
    const week_day = filter.week_day as string;
    const time = filter.time as string;


    if(!filter.week_day || !filter.subject || !filter.time){
      return res.status(400).json({
        error: 'Faltando filtros'
      })
    }

    const timeInMinutes = convertHourToMinutes(time);
    const classes = await db('classes')
    .whereExists(function() {
      this.select('class_schedule.*')
        .from('class_schedule')
        .whereRaw('`class_schedule`.`class_id` = `classes`.`id`') 
        .whereRaw('`class_schedule`.`week_day` = ??', [Number(week_day)]) 

        .whereRaw('`class_schedule`.`from` <= ??', [timeInMinutes])
        .whereRaw('`class_schedule`.`to` > ??', [timeInMinutes])
    })

    //innerjoin
      .where('subject', '=', subject)
      .join('users', 'classes.user_id', '=', 'users.id')
      .select(['classes.*', 'users.*'])

    console.log(timeInMinutes);

    return res.json(classes);
  }

  async create(req: Request, res: Response){
    const {
      name,
      avatar,
      whatsapp,
      bio,
      subject,
      cost,
      schedule
    } = req.body;
    
    const trx = await db.transaction();
  
    try {
      const insertUsersIds = await trx('users').insert({
        name,
        avatar,
        whatsapp,
        bio
      });
    
      const user_id  = insertUsersIds[0];
    
     const insertClassesIds = await trx('classes').insert({
        subject,
        cost,
        user_id
      });
    
      const class_id = insertClassesIds[0];
    
      const classSchedule = schedule.map((item: ScheduleItem) => {
        return {
          class_id,
          week_day: item.week_day,
          from: convertHourToMinutes(item.from),
          to: convertHourToMinutes(item.to)
        }
      })
    
      await trx('class_schedule').insert(classSchedule);
    
      await trx.commit();
    
      return res.status(201).send()
    }catch(err){
      await trx.rollback();
  
      return res.status(400).json({
        error: 'Erro ao criar nova classe'
      })
    }
  }
}