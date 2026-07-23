import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Central do Buffet — Login" },
      {
        name: "description",
        content: "Acesse sua conta do Central do Buffet.",
      },
    ],
  }),
  component: AuthPage,
});


const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido")
    .max(255),

  password: z
    .string()
    .min(6, "A senha deve ter no mínimo 6 caracteres")
    .max(72),
});


const signUpSchema = signInSchema.extend({

  fullName: z
    .string()
    .trim()
    .min(2, "Informe seu nome"),

  businessName: z
    .string()
    .trim()
    .min(2, "Informe o nome do negócio"),
});


function AuthPage() {

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    supabase.auth.getSession()
      .then(({ data }) => {

        if(data.session){

          navigate({
            to:"/dashboard",
            replace:true
          });

        }

      });


  }, [navigate]);




  async function handleSignIn(
    e: FormEvent<HTMLFormElement>
  ){

    e.preventDefault();


    const form = new FormData(e.currentTarget);


    const parsed = signInSchema.safeParse(
      Object.fromEntries(form)
    );


    if(!parsed.success){

      toast.error(
        parsed.error.issues[0].message
      );

      return;
    }



    setLoading(true);



    const {
      error
    } = await supabase.auth.signInWithPassword(
      parsed.data
    );


    setLoading(false);



    if(error){

      toast.error(
        error.message
      );

      return;
    }



    toast.success(
      "Login realizado com sucesso!"
    );


    navigate({
      to:"/dashboard",
      replace:true
    });

  }





  async function handleSignUp(
    e: FormEvent<HTMLFormElement>
  ){

    e.preventDefault();


    const form = new FormData(e.currentTarget);



    const parsed =
      signUpSchema.safeParse(
        Object.fromEntries(form)
      );



    if(!parsed.success){

      toast.error(
        parsed.error.issues[0].message
      );

      return;

    }



    setLoading(true);



    const {
      error,
      data
    } = await supabase.auth.signUp({

      email:parsed.data.email,

      password:parsed.data.password,


      options:{

        emailRedirectTo:
          `${window.location.origin}/auth/callback`,


        data:{

          full_name:
            parsed.data.fullName,


          business_name:
            parsed.data.businessName,

        }

      }

    });



    setLoading(false);



    if(error){

      toast.error(
        error.message
      );

      return;

    }



    if(data.session){

      toast.success(
        "Conta criada com sucesso!"
      );


      navigate({
        to:"/dashboard",
        replace:true
      });


    }else{


      toast.success(
        "Confira seu e-mail para confirmar o cadastro."
      );

    }


  }






  async function handleGoogle(){

    setLoading(true);


    const result =
      await lovable.auth.signInWithOAuth(
        "google",
        {

          redirect_uri:
            `${window.location.origin}/auth/callback`

        }
      );



    if(result.error){

      setLoading(false);

      toast.error(
        "Erro ao entrar com Google"
      );

      return;

    }


  }





return (

<div className="min-h-screen grid lg:grid-cols-2 bg-background">


<div className="
relative overflow-hidden
hidden lg:flex flex-col justify-between
p-12 text-white
bg-[linear-gradient(135deg,#ff8a1e_0%,#ff4d3d_45%,#ffd23f_100%)]
">

{/* Animated ambient blobs */}
<div aria-hidden className="pointer-events-none absolute inset-0">
  <div className="absolute -top-24 -left-16 size-80 rounded-full bg-yellow-300/40 blur-3xl animate-[float_9s_ease-in-out_infinite]" />
  <div className="absolute top-1/3 -right-20 size-96 rounded-full bg-rose-500/40 blur-3xl animate-[float_11s_ease-in-out_infinite_reverse]" />
  <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-orange-200/50 blur-3xl animate-[float_13s_ease-in-out_infinite]" />
  <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
</div>

{/* Floating emojis */}
<div aria-hidden className="pointer-events-none absolute inset-0 text-3xl select-none">
  <span className="absolute top-[18%] left-[22%] animate-[float_7s_ease-in-out_infinite]">🔥</span>
  <span className="absolute top-[62%] left-[12%] animate-[float_9s_ease-in-out_infinite_reverse]">🍖</span>
  <span className="absolute top-[30%] right-[18%] animate-[float_8s_ease-in-out_infinite]">🥩</span>
  <span className="absolute top-[75%] right-[26%] animate-[float_10s_ease-in-out_infinite_reverse]">🎉</span>
  <span className="absolute top-[45%] left-[48%] animate-[float_12s_ease-in-out_infinite]">✨</span>
</div>


<div className="relative flex items-center gap-3">


<div className="
size-11 rounded-2xl
bg-white/25 backdrop-blur-md
ring-1 ring-white/40
flex items-center justify-center
shadow-xl shadow-black/10
animate-[wiggle_3s_ease-in-out_infinite]
">

<Building2 />

</div>


<div>

<div className="font-extrabold text-xl tracking-tight">
Central do Buffet
</div>


<div className="text-xs opacity-90 font-medium">
Gestão de Buffet
</div>


</div>


</div>




<div className="relative max-w-md animate-[slideUp_.8s_cubic-bezier(0.16,1,0.3,1)_both]">


<h1 className="
text-5xl font-black leading-[1.05] tracking-tight
drop-shadow-[0_2px_20px_rgba(0,0,0,0.15)]
">

Seu buffet organizado,
<span className="block bg-gradient-to-r from-yellow-100 to-white bg-clip-text text-transparent">
sem complicação.
</span>

</h1>


<p className="mt-5 opacity-95 text-lg leading-relaxed">

Controle clientes, eventos,
agenda e equipe em
um único lugar.

</p>

<div className="mt-8 flex gap-2 flex-wrap">
  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur ring-1 ring-white/30 animate-[pulse_2.5s_ease-in-out_infinite]">🚀 Rápido</span>
  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur ring-1 ring-white/30 animate-[pulse_2.5s_ease-in-out_infinite_.4s]">🎯 Simples</span>
  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur ring-1 ring-white/30 animate-[pulse_2.5s_ease-in-out_infinite_.8s]">💛 Feito pra você</span>
</div>


</div>



<p className="relative text-xs opacity-80 font-medium">

© 2026 Central do Buffet

</p>


</div>





<div className="
flex items-center justify-center
p-6
">


<div className="w-full max-w-md">


<Tabs defaultValue="signin">


<TabsList className="grid grid-cols-2">

<TabsTrigger value="signin">
Entrar
</TabsTrigger>


<TabsTrigger value="signup">
Criar conta
</TabsTrigger>


</TabsList>






<TabsContent value="signin">


<form
onSubmit={handleSignIn}
className="space-y-4 mt-6"
>


<div>

<Label>
E-mail
</Label>


<Input
name="email"
type="email"
/>


</div>




<div>

<Label>
Senha
</Label>


<Input
name="password"
type="password"
/>


</div>



<Button
className="w-full"
disabled={loading}
>

{
loading
?
"Entrando..."
:
"Entrar"
}


</Button>



</form>




<Button

variant="outline"

className="w-full mt-4"

onClick={handleGoogle}

>

Entrar com Google

</Button>



</TabsContent>







<TabsContent value="signup">


<form
onSubmit={handleSignUp}
className="space-y-4 mt-6"
>


<div>

<Label>
Nome
</Label>


<Input
name="fullName"
/>

</div>



<div>

<Label>
Nome do negócio
</Label>


<Input
name="businessName"
/>

</div>



<div>

<Label>
E-mail
</Label>


<Input
name="email"
type="email"
/>

</div>



<div>

<Label>
Senha
</Label>


<Input
name="password"
type="password"
/>

</div>




<Button
className="w-full"
disabled={loading}
>

{
loading
?
"Criando..."
:
"Criar conta"
}

</Button>



</form>


</TabsContent>




</Tabs>


</div>


</div>


</div>

);


}
