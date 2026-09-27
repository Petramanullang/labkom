import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { batchSchema } from "@/lib/validation";
import { toBatch, type BatchRow } from "@/lib/batch";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";


export type BatchWithStats = ReturnType<typeof toBatch> & {
  stats: {
    orders: number;
    verifiedOrders: number;
    gross: number;
    itemsSold: number;
  };
};



export async function GET() {

  const auth = await requireAdmin();


  if (!auth.user) {

    return NextResponse.json(
      {
        success: false,
        error: auth.error,
      },
      {
        status: 401,
      }
    );

  }


  try {

    const supabase = createAdminClient();


    const [
      batchResult,
      orderResult,
    ] = await Promise.all([

      supabase
        .from("sales_batches")
        .select(
          "id,name,description,starts_at,ends_at,delivery_date,note,is_active,created_at"
        )
        .order(
          "starts_at",
          {
            ascending:false,
          }
        ),


      supabase
        .from("orders")
        .select(
          "batch_id,status,total_amount,quantity"
        ),

    ]);



    if(batchResult.error)
      throw batchResult.error;


    if(orderResult.error)
      throw orderResult.error;



    const stats = new Map<
      string,
      {
        orders:number;
        verifiedOrders:number;
        gross:number;
        itemsSold:number;
      }
    >();



    const unassigned = {
      orders:0,
      verifiedOrders:0,
      gross:0,
      itemsSold:0,
    };



    (orderResult.data ?? []).forEach((row)=>{


      const key =
        row.batch_id ?? "";



      const bucket =
        key

        ?

        (
          stats.get(key)
          ??
          {
            orders:0,
            verifiedOrders:0,
            gross:0,
            itemsSold:0,
          }

        )

        :

        unassigned;



      bucket.orders += 1;


      bucket.itemsSold +=
        Number(row.quantity ?? 0);



      if(row.status === "verified"){

        bucket.verifiedOrders += 1;

        bucket.gross +=
          Number(row.total_amount ?? 0);

      }



      if(key){

        stats.set(
          key,
          bucket
        );

      }


    });



    const batches =
      (
        (batchResult.data ?? []) as unknown as BatchRow[]).map((row)=>({

        ...toBatch(row),

        stats:
          stats.get(row.id)
          ??
          {
            orders:0,
            verifiedOrders:0,
            gross:0,
            itemsSold:0,
          },

      }));



    return NextResponse.json({

      success:true,

      data:{
        batches,
        unassigned,
      },

    });



  } catch(error){


    console.error(
      "list batches error",
      error
    );


    return NextResponse.json(

      {
        success:false,
        error:"Gagal memuat daftar batch.",
      },

      {
        status:500,
      }

    );

  }

}





async function findOverlap(
  supabase: ReturnType<typeof createAdminClient>,
  startDate: string,
  endDate: string,
  excludeId?: string,
) {
  let query = supabase
    .from("sales_batches")
    .select("id,name,starts_at,ends_at")
    .eq("is_active", true)
    .lte("starts_at", endDate)
    .or(`ends_at.is.null,ends_at.gte.${startDate}`)
    .limit(1);

  if (excludeId) query = query.neq("id", excludeId);

  const { data } = await query;
  return data?.[0] ?? null;
}



export async function POST(
  request:Request
){


  const auth =
    await requireAdmin();



  if(!auth.user){

    return NextResponse.json(

      {
        success:false,
        error:auth.error,
      },

      {
        status:401,
      }

    );

  }




  const parsed =
    batchSchema.safeParse(
      await request.json().catch(
        ()=>null
      )
    );



  if(!parsed.success){

    return NextResponse.json(

      {
        success:false,
        error:
          parsed.error.issues[0]?.message
          ??
          "Data batch tidak valid.",
      },

      {
        status:400,
      }

    );

  }




  const input =
    parsed.data;



  const supabase =
    createAdminClient();




  try {


    /**
     * Cek overlap hanya jika endDate tersedia
     */
    if(
      input.isActive
      &&
      !input.allowOverlap
      &&
      input.endDate
    ){

      const overlap =
        await findOverlap(

          supabase,

          input.startDate,

          input.endDate

        );



      if(overlap){

        return NextResponse.json(

          {
            success:false,

            error:
            `Periode ini bertabrakan dengan batch aktif "${overlap.name}".`,
          },

          {
            status:409,
          }

        );

      }

    }




    const {
      data,
      error
    } =
    await supabase

      .from("sales_batches")

      .insert({

        name:
          input.name,

        description:
          input.description ?? input.note ?? null,

        starts_at:
          input.startDate,

        ends_at:
          input.endDate ?? null,

        delivery_date:
          input.deliveryDate ?? null,

        note:
          input.note ?? input.description ?? null,

        is_active:
          input.isActive,

      })

      .select(
        "id,name,description,starts_at,ends_at,delivery_date,note,is_active,created_at"
      )

      .single();




    if(error)
      throw error;



    return NextResponse.json(

      {
        success:true,

        data:
          toBatch(
            data as BatchRow
          ),
      },

      {
        status:201,
      }

    );



  } catch(error){


    console.error(
      "create batch error",
      error
    );



    const message =
      (error as {code?:string}).code === "23505"

      ?

      "Nama batch itu sudah dipakai."

      :

      "Gagal menyimpan batch baru.";



    return NextResponse.json(

      {
        success:false,
        error:message,
      },

      {
        status:400,
      }

    );

  }

}