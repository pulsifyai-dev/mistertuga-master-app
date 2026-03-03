'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { editOrderSchema, type EditOrderSchema, type Order } from '../types';

interface OrderEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSubmit: (data: EditOrderSchema) => void;
}

export function OrderEditDialog({ open, onOpenChange, order, onSubmit }: OrderEditDialogProps) {
  const form = useForm<EditOrderSchema>({ resolver: zodResolver(editOrderSchema) });

  useEffect(() => {
    if (order) {
      form.reset({
        customerName: order.customer.name,
        customerAddress: order.customer.address,
        customerPhone: String(order.customer.phone || ''),
        trackingNumber: order.trackingNumber || '',
        note: order.note || '',
      });
    }
  }, [order, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Order {order?.id}</DialogTitle>
          <DialogDescription>Update customer details, tracking, and notes.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="customerName" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="customerAddress" render={({ field }) => <FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="customerPhone" render={({ field }) => <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="trackingNumber" render={({ field }) => <FormItem><FormLabel>Tracking</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="note" render={({ field }) => <FormItem><FormLabel>Note</FormLabel><FormControl><Textarea {...field} placeholder="Add a manual note for this order..." /></FormControl><FormMessage /></FormItem>} />
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" className="bg-purple-600 text-white hover:bg-purple-500 active:bg-purple-700 active:scale-[0.98]">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
